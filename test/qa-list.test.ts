import { describe, expect, test } from "bun:test";
import { createEmptyQaQuestionCache, rememberQuestionFromEvent } from "../src/lib/qa-cache.js";
import { listQuestions, listQuestionsDirect } from "../src/lib/qa-list.js";

describe("qa list helpers", () => {
  test("lists newest questions first by default with default limit 10", async () => {
    const cache = createEmptyQaQuestionCache();
    const sdk = makeSdk({
      latestBlock: 20_000,
      logs: [],
      questions: Array.from({ length: 12 }, (_, id) => question(id, "foo")),
    });

    const results = await listQuestions(sdk, { cache });

    expect(results.map((q) => q.id)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    expect(sdk.questionReads).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  });

  test("supports asc order and page", async () => {
    const cache = createEmptyQaQuestionCache();
    const sdk = makeSdk({
      latestBlock: 20_000,
      logs: [],
      questions: Array.from({ length: 8 }, (_, id) => question(id, "foo")),
    });

    const results = await listQuestionsDirect(sdk, { order: "asc", page: 2, limit: 3, cache });

    expect(results.map((q) => q.id)).toEqual([3, 4, 5]);
    expect(sdk.questionReads).toEqual([3, 4, 5]);
  });

  test("direct search returns matching unsettled questions in newest-first order", async () => {
    const cache = createEmptyQaQuestionCache();
    const sdk = makeSdk({
      latestBlock: 20_000,
      logs: [],
      questions: [
        question(0, "foo"),
        question(1, "foo"),
        question(2, "foo", { settled: true }),
        question(3, "bar"),
      ],
    });

    const results = await listQuestionsDirect(sdk, { tags: "foo", onlyUnsettled: true, limit: 2, cache });

    expect(results.map((q) => q.id)).toEqual([1, 0]);
  });

  test("direct search without filters reads only the requested number of questions", async () => {
    const cache = createEmptyQaQuestionCache();
    const sdk = makeSdk({
      latestBlock: 20_000,
      logs: [],
      questions: [
        question(0, "foo"),
        question(1, "foo"),
        question(2, "foo"),
      ],
    });

    const results = await listQuestionsDirect(sdk, { limit: 1, cache });

    expect(results.map((q) => q.id)).toEqual([2]);
    expect(sdk.questionReads).toEqual([2]);
  });

  test("direct tag search skips cached nonmatching question IDs", async () => {
    const cache = createEmptyQaQuestionCache();
    rememberQuestionFromEvent(cache, { id: 2, tags: "bar", blockNumber: 10, blockHash: "0xaaa" });
    const sdk = makeSdk({
      latestBlock: 20_000,
      blockHashes: { 10: "0xaaa" },
      logs: [],
      questions: [
        question(0, "foo"),
        question(1, "foo"),
        question(2, "bar"),
      ],
    });

    const results = await listQuestionsDirect(sdk, { tags: "foo", limit: 1, cache });

    expect(results.map((q) => q.id)).toEqual([1]);
    expect(sdk.questionReads).toEqual([1, 0]);
  });

  test("direct tag search ignores stale cached tags after a reverted block", async () => {
    const cache = createEmptyQaQuestionCache();
    rememberQuestionFromEvent(cache, { id: 2, tags: "bar", blockNumber: 10, blockHash: "0xold" });
    const sdk = makeSdk({
      latestBlock: 20_000,
      blockHashes: { 10: "0xnew" },
      logs: [],
      questions: [
        question(0, "bar"),
        question(1, "bar"),
        question(2, "foo"),
      ],
    });

    const results = await listQuestionsDirect(sdk, { tags: "foo", limit: 1, cache });

    expect(results.map((q) => q.id)).toEqual([2]);
    expect(sdk.questionReads).toContain(2);
    expect(cache.questions["2"].tags).toBe("foo");
    expect(cache.questions["2"].discoveredBlockHash).toBe("0x20000");
  });
});

function makeSdk(input: {
  latestBlock: number;
  blockHashes?: Record<number, string>;
  logs: Array<{ blockNumber: number; args: Record<string, unknown> }>;
  questions: Array<Record<string, unknown> & { id: number }>;
}): any {
  const questionById = new Map(input.questions.map((q) => [q.id, q]));
  const sdk: any = {
    addresses: {
      qaEscrow: "0x0000000000000000000000000000000000000001",
    },
    deployBlock: 0,
    queryCalls: [] as Array<{ from: number; to: number }>,
    questionReads: [] as number[],
    provider: {
      getBlockNumber: async () => input.latestBlock,
      getBlock: async (blockNumber: number) => ({ hash: input.blockHashes?.[blockNumber] ?? `0x${blockNumber}` }),
    },
    qa: {
      filters: {
        QuestionPosted: () => ({}),
      },
      interface: {
        parseLog: (log: any) => ({ args: log.args }),
      },
      queryFilter: async (_filter: unknown, from: number, to: number) => {
        sdk.queryCalls.push({ from, to });
        return input.logs.filter((log) => log.blockNumber >= from && log.blockNumber <= to);
      },
      nextQuestionId: async () => BigInt(input.questions.length),
      questions: async (id: number) => {
        sdk.questionReads.push(id);
        const q = questionById.get(id);
        if (!q) throw new Error(`missing question ${id}`);
        return q;
      },
    },
  };
  return sdk;
}

function question(id: number, tags: string, overrides: { settled?: boolean } = {}): Record<string, unknown> & { id: number } {
  return {
    id,
    asker: "0x0000000000000000000000000000000000000001",
    ipfsCID: `Qm${id}`,
    tags,
    reward: 1n,
    deadline: 2n,
    createdAt: 3n,
    settled: overrides.settled ?? false,
    answerCount: 0n,
    isPremium: false,
  };
}
