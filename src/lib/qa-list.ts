import type { ChisikiSDK, QuestionInfo } from "@chisiki/sdk";
import {
  type QaQuestionCache,
  forgetCachedQuestion,
  getCachedQuestionTags,
  loadQaQuestionCache,
  rememberQuestionFromStorage,
  saveQaQuestionCache,
} from "./qa-cache.js";

const DEFAULT_LIMIT = 10;
const DEFAULT_PAGE = 1;
const DEFAULT_ORDER: QaListOrder = "desc";
const RPC_BATCH_SIZE = 10;

export type QaListOrder = "asc" | "desc";

export interface QaListOptions {
  tags?: string;
  onlyUnsettled?: boolean;
  limit?: number;
  page?: number;
  order?: string;
  cache?: QaQuestionCache | null;
}

export async function listQuestions(sdk: ChisikiSDK, options: QaListOptions): Promise<QuestionInfo[]> {
  return listQuestionsDirect(sdk, options);
}

export async function getQuestion(sdk: ChisikiSDK, id: number): Promise<QuestionInfo> {
  assertQuestionId(id);

  const nextId = await sdk.qa.nextQuestionId();
  if (BigInt(id) >= nextId) {
    throw new Error(`Question not found: ${id}`);
  }

  return readQuestionInfo(sdk, id, null, null);
}

export async function listQuestionsDirect(sdk: ChisikiSDK, options: QaListOptions): Promise<QuestionInfo[]> {
  const limit = resolveLimit(options.limit);
  if (limit === 0) return [];

  const wantedTags = parseTags(options.tags);
  const order = resolveOrder(options.order);
  const page = resolvePage(options.page);
  const offset = (page - 1) * limit;
  const cache = wantedTags || options.cache !== undefined ? await resolveCache(sdk, options.cache) : null;
  const nextId = Number(await sdk.qa.nextQuestionId());
  const results: QuestionInfo[] = [];
  const anchor = wantedTags ? await resolveStorageAnchor(sdk, cache) : null;

  try {
    const needsFiltering = !!wantedTags || !!options.onlyUnsettled;
    if (!needsFiltering) {
      const ids = questionIdsForPage(nextId, offset, limit, order);
      const questions = await Promise.all(ids.map((questionId) => readQuestion(sdk, questionId, cache, anchor)));
      return questions.filter((question): question is QuestionInfo => question !== null);
    }

    let skipped = 0;
    for (let id = firstQuestionId(nextId, order); isQuestionIdInRange(id, nextId, order) && results.length < limit;) {
      const batchIds = nextQuestionIdBatch(id, nextId, order, RPC_BATCH_SIZE);
      id = advanceQuestionId(batchIds[batchIds.length - 1], order);
      const readableIds = await filterIdsByCachedTags(sdk, batchIds, wantedTags, cache);
      const questions = await Promise.all(readableIds.map((questionId) => readQuestion(sdk, questionId, cache, anchor)));

      for (const question of questions) {
        if (!question) continue;
        if (options.onlyUnsettled && question.settled) continue;
        if (!matchesTags(question.tags, wantedTags)) continue;
        if (skipped < offset) {
          skipped++;
          continue;
        }
        results.push(question);
        if (results.length >= limit) break;
      }
    }
  } finally {
    await saveQaQuestionCache(cache);
  }

  return results;
}

async function readQuestion(
  sdk: ChisikiSDK,
  id: number,
  cache: QaQuestionCache | null,
  anchor: CacheAnchor | null,
): Promise<QuestionInfo | null> {
  try {
    return await readQuestionInfo(sdk, id, cache, anchor);
  } catch {
    return null;
  }
}

async function readQuestionInfo(
  sdk: ChisikiSDK,
  id: number,
  cache: QaQuestionCache | null,
  anchor: CacheAnchor | null,
): Promise<QuestionInfo> {
  const q = await sdk.qa.questions(id);
  rememberQuestionFromStorage(cache, id, q, anchor ?? undefined);
  return {
    id,
    asker: q.asker,
    ipfsCID: q.ipfsCID,
    tags: q.tags,
    reward: q.reward,
    deadline: q.deadline,
    createdAt: q.createdAt,
    settled: q.settled,
    answerCount: Number(q.answerCount),
    isPremium: q.isPremium ?? false,
  };
}

async function filterIdsByCachedTags(
  sdk: ChisikiSDK,
  ids: number[],
  wantedTags: Set<string> | undefined,
  cache: QaQuestionCache | null,
): Promise<number[]> {
  if (!wantedTags || !cache) return ids;
  const blockHashes = new Map<number, string | null>();
  const filtered: number[] = [];

  for (const id of ids) {
    const cachedTags = getCachedQuestionTags(cache, id);
    if (cachedTags === undefined || matchesTags(cachedTags, wantedTags)) {
      filtered.push(id);
      continue;
    }

    if (!(await isCacheAnchorValid(sdk, cache, id, blockHashes))) {
      filtered.push(id);
    }
  }

  return filtered;
}

async function resolveCache(sdk: ChisikiSDK, cache: QaQuestionCache | null | undefined): Promise<QaQuestionCache | null> {
  if (cache !== undefined) return cache;
  return loadQaQuestionCache(sdk.addresses.qaEscrow);
}

interface CacheAnchor {
  blockNumber: number;
  blockHash: string;
}

async function resolveStorageAnchor(sdk: ChisikiSDK, cache: QaQuestionCache | null): Promise<CacheAnchor | null> {
  if (!cache) return null;
  try {
    const blockNumber = await sdk.provider.getBlockNumber();
    const block = await sdk.provider.getBlock(blockNumber);
    if (!block?.hash) return null;
    return { blockNumber, blockHash: block.hash };
  } catch {
    return null;
  }
}

async function isCacheAnchorValid(
  sdk: ChisikiSDK,
  cache: QaQuestionCache,
  id: number,
  blockHashes: Map<number, string | null>,
): Promise<boolean> {
  const cached = cache.questions[String(id)];
  if (cached?.discoveredBlock === undefined || !cached.discoveredBlockHash) {
    return false;
  }

  if (!blockHashes.has(cached.discoveredBlock)) {
    try {
      const block = await sdk.provider.getBlock(cached.discoveredBlock);
      blockHashes.set(cached.discoveredBlock, block?.hash ?? null);
    } catch {
      blockHashes.set(cached.discoveredBlock, null);
    }
  }

  const currentHash = blockHashes.get(cached.discoveredBlock);
  const valid = currentHash === cached.discoveredBlockHash;
  if (!valid) {
    forgetCachedQuestion(cache, id);
  }
  return valid;
}

function parseTags(tags?: string): Set<string> | undefined {
  const values = tags?.split(",").map((tag) => tag.trim()).filter(Boolean);
  return values && values.length > 0 ? new Set(values) : undefined;
}

function matchesTags(questionTags: string, wantedTags: Set<string> | undefined): boolean {
  if (!wantedTags) return true;
  return questionTags.split(",").some((tag) => wantedTags.has(tag.trim()));
}

function resolveLimit(value?: number): number {
  const limit = value ?? DEFAULT_LIMIT;
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new Error(`Invalid limit: ${value}`);
  }
  return limit;
}

function resolvePage(value?: number): number {
  const page = value ?? DEFAULT_PAGE;
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error(`Invalid page: ${value}`);
  }
  return page;
}

function resolveOrder(value?: string): QaListOrder {
  const order = value ?? DEFAULT_ORDER;
  if (order !== "asc" && order !== "desc") {
    throw new Error(`Invalid order: ${value}. Expected "asc" or "desc"`);
  }
  return order;
}

function assertQuestionId(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid question ID: ${value}`);
  }
}

function questionIdsForPage(nextId: number, offset: number, limit: number, order: QaListOrder): number[] {
  if (order === "asc") {
    const start = offset;
    if (start >= nextId) return [];
    const end = Math.min(nextId - 1, start + limit - 1);
    return range(start, end, 1);
  }

  const start = nextId - 1 - offset;
  if (start < 0) return [];
  const end = Math.max(0, start - limit + 1);
  return range(start, end, -1);
}

function firstQuestionId(nextId: number, order: QaListOrder): number {
  return order === "asc" ? 0 : nextId - 1;
}

function isQuestionIdInRange(id: number, nextId: number, order: QaListOrder): boolean {
  return order === "asc" ? id < nextId : id >= 0;
}

function nextQuestionIdBatch(start: number, nextId: number, order: QaListOrder, limit: number): number[] {
  const ids: number[] = [];
  for (let id = start; ids.length < limit && isQuestionIdInRange(id, nextId, order); id = advanceQuestionId(id, order)) {
    ids.push(id);
  }
  return ids;
}

function advanceQuestionId(id: number, order: QaListOrder): number {
  return order === "asc" ? id + 1 : id - 1;
}

function range(start: number, end: number, step: 1 | -1): number[] {
  const ids: number[] = [];
  for (let id = start; step === 1 ? id <= end : id >= end; id += step) {
    ids.push(id);
  }
  return ids;
}
