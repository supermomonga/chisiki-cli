import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfigDir } from "./config.js";

const CACHE_VERSION = 1;

export interface CachedQuestionImmutable {
  id: number;
  asker?: string;
  ipfsCID?: string;
  tags?: string;
  reward?: string;
  deadline?: string;
  createdAt?: string;
  isPremium?: boolean;
  discoveredBlock?: number;
  discoveredBlockHash?: string;
}

export interface QaQuestionCache {
  filePath?: string;
  qaEscrow?: string;
  questions: Record<string, CachedQuestionImmutable>;
  dirty: boolean;
}

interface QaQuestionCacheFile {
  version: number;
  qaEscrow: string;
  questions: Record<string, CachedQuestionImmutable>;
}

export function createEmptyQaQuestionCache(filePath?: string, qaEscrow?: string): QaQuestionCache {
  return { filePath, qaEscrow, questions: {}, dirty: false };
}

export async function loadQaQuestionCache(qaEscrow: string): Promise<QaQuestionCache> {
  const filePath = getQaQuestionCachePath(qaEscrow);
  if (!existsSync(filePath)) {
    return createEmptyQaQuestionCache(filePath, qaEscrow);
  }

  try {
    const parsed = JSON.parse(await readFile(filePath, "utf-8")) as QaQuestionCacheFile;
    if (parsed.version !== CACHE_VERSION || parsed.qaEscrow.toLowerCase() !== qaEscrow.toLowerCase()) {
      return createEmptyQaQuestionCache(filePath, qaEscrow);
    }
    return {
      filePath,
      qaEscrow,
      questions: parsed.questions ?? {},
      dirty: false,
    };
  } catch {
    return createEmptyQaQuestionCache(filePath, qaEscrow);
  }
}

export async function saveQaQuestionCache(cache: QaQuestionCache | null | undefined): Promise<void> {
  if (!cache?.filePath || !cache.qaEscrow || !cache.dirty) return;

  try {
    await mkdir(join(getConfigDir(), "cache"), { recursive: true });
    const payload: QaQuestionCacheFile = {
      version: CACHE_VERSION,
      qaEscrow: cache.qaEscrow,
      questions: cache.questions,
    };
    const tmpPath = `${cache.filePath}.tmp-${process.pid}`;
    await writeFile(tmpPath, JSON.stringify(payload), "utf-8");
    await rename(tmpPath, cache.filePath);
    cache.dirty = false;
  } catch {
    // Cache persistence must never make a read-only command fail.
  }
}

export function getCachedQuestionTags(cache: QaQuestionCache | null | undefined, id: number): string | undefined {
  return cache?.questions[String(id)]?.tags;
}

export function rememberQuestionFromEvent(
  cache: QaQuestionCache | null | undefined,
  question: {
    id: number;
    asker?: unknown;
    tags?: unknown;
    reward?: unknown;
    deadline?: unknown;
    blockNumber?: number;
    blockHash?: string;
  },
): void {
  if (!cache) return;
  mergeQuestion(cache, question.id, {
    asker: stringifyMaybe(question.asker),
    tags: stringifyMaybe(question.tags),
    reward: stringifyMaybe(question.reward),
    deadline: stringifyMaybe(question.deadline),
    discoveredBlock: question.blockNumber,
    discoveredBlockHash: question.blockHash,
  });
}

export function rememberQuestionFromStorage(
  cache: QaQuestionCache | null | undefined,
  id: number,
  q: any,
  anchor?: { blockNumber: number; blockHash: string },
): void {
  if (!cache) return;
  mergeQuestion(cache, id, {
    asker: stringifyMaybe(q.asker),
    ipfsCID: stringifyMaybe(q.ipfsCID),
    tags: stringifyMaybe(q.tags),
    reward: stringifyMaybe(q.reward),
    deadline: stringifyMaybe(q.deadline),
    createdAt: stringifyMaybe(q.createdAt),
    isPremium: Boolean(q.isPremium ?? false),
    discoveredBlock: anchor?.blockNumber,
    discoveredBlockHash: anchor?.blockHash,
  });
}

export function forgetCachedQuestion(cache: QaQuestionCache | null | undefined, id: number): void {
  if (!cache) return;
  const key = String(id);
  if (cache.questions[key]) {
    delete cache.questions[key];
    cache.dirty = true;
  }
}

function mergeQuestion(cache: QaQuestionCache, id: number, next: Omit<CachedQuestionImmutable, "id">): void {
  const key = String(id);
  const prev = cache.questions[key] ?? { id };
  const merged: CachedQuestionImmutable = { ...prev };

  for (const [k, v] of Object.entries(next) as Array<[keyof Omit<CachedQuestionImmutable, "id">, unknown]>) {
    if (v !== undefined && merged[k] !== v) {
      (merged as unknown as Record<keyof Omit<CachedQuestionImmutable, "id">, unknown>)[k] = v;
      cache.dirty = true;
    }
  }

  if (!cache.questions[key]) {
    cache.questions[key] = merged;
    cache.dirty = true;
  } else {
    cache.questions[key] = merged;
  }
}

function getQaQuestionCachePath(qaEscrow: string): string {
  const cacheKey = qaEscrow.toLowerCase().replace(/[^a-z0-9]/g, "");
  return join(getConfigDir(), "cache", `qa-questions-${cacheKey}.json`);
}

function stringifyMaybe(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value);
}
