import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

// CIDv0: base58btc, always "Qm" + 44 chars from the base58 alphabet
const CID_V0 = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
// CIDv1 (base32 lowercase, the common multibase for IPFS): "b" + base32 chars.
// Minimum length covers sha-256 dag-pb (~59 chars); accept longer for larger multihashes.
const CID_V1 = /^b[a-z2-7]{50,}$/;

function assertIpfsCid(input: string): void {
  const cid = input.startsWith("ipfs://") ? input.slice("ipfs://".length) : input;
  if (!CID_V0.test(cid) && !CID_V1.test(cid)) {
    throw new Error(`Invalid IPFS CID: expected CIDv0 (Qm...) or CIDv1 (b...), got "${input}"`);
  }
}

export const qaCommand = new Command()
  .description("Q&A operations")
  .action(function () { this.showHelp(); })
  .command("post-question")
  .description("Post a question")
  .arguments("<ipfs-cid:string>")
  .option("--tags <tags:string>", "Question tags (comma-separated)", { required: true })
  .option("--reward <amount:string>", "Reward amount (CKT)", { required: true })
  .option("--deadline <hours:number>", "Answer deadline (hours)", { required: true })
  .action(async (options: any, ipfsCid: string) => {
    try {
      assertIpfsCid(ipfsCid);
      const sdk = await createSDK(options);
      const result = await sdk.postQuestion(ipfsCid, options.tags, options.reward, options.deadline);
      outputResult({ txHash: result.hash, questionId: result.questionId, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("post-premium-question")
  .description("Post a premium question")
  .arguments("<ipfs-cid:string>")
  .option("--tags <tags:string>", "Question tags (comma-separated)", { required: true })
  .option("--reward <amount:string>", "Reward amount (CKT)", { required: true })
  .option("--deadline <hours:number>", "Answer deadline (hours)", { required: true })
  .action(async (options: any, ipfsCid: string) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.postPremiumQuestion(ipfsCid, options.tags, options.reward, options.deadline);
      outputResult({
        txHash: result.hash,
        questionId: result.questionId,
        premiumBurned: result.premiumBurned,
        blockNumber: result.blockNumber,
      }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("post-answer")
  .description("Post an answer")
  .arguments("<question-id:number> <ipfs-cid:string>")
  .action(async (options: any, questionId: number, ipfsCid: string) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.postAnswer(questionId, ipfsCid);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("upvote")
  .description("Upvote an answer")
  .arguments("<question-id:number> <answer-index:number>")
  .action(async (options: any, questionId: number, answerIndex: number) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.upvoteAnswer(questionId, answerIndex);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("commit-best")
  .description("Commit best answer (commit-reveal step 1)")
  .arguments("<question-id:number> <best-index:number>")
  .option("--runner1 <index:number>", "Runner-up 1 index")
  .option("--runner2 <index:number>", "Runner-up 2 index")
  .option("--salt <salt:string>", "Salt")
  .action(async (options: any, questionId: number, bestIndex: number) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.commitBestAnswer(questionId, bestIndex, options.runner1, options.runner2, options.salt);
      outputResult({ hash: result.hash, salt: result.salt, bestIdx: result.bestIdx, runner1: result.runner1, runner2: result.runner2 }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("reveal-best")
  .description("Reveal best answer (commit-reveal step 2)")
  .arguments("<question-id:number> <best-index:number> <runner1:string> <runner2:string> <salt:string>")
  .action(async (options: any, questionId: number, bestIndex: number, runner1: string, runner2: string, salt: string) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.revealBestAnswer(questionId, bestIndex, BigInt(runner1), BigInt(runner2), salt);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("withdraw")
  .description("Withdraw reward from unanswered question")
  .arguments("<question-id:number>")
  .action(async (options: any, questionId: number) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.withdrawQuestion(questionId);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("auto-settle")
  .description("Auto-settle expired question (1 CKT keeper reward)")
  .arguments("<question-id:number>")
  .action(async (options: any, questionId: number) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.triggerAutoSettle(questionId);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("search")
  .description("Search questions (eth_getLogs based)")
  .option("--tags <tags:string>", "Tag filter")
  .option("--unsettled", "Unsettled only")
  .option("--from-block <block:number>", "Start block")
  .option("--max-results <n:number>", "Max results")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const results = await sdk.searchQuestions(options.tags, !!options.unsettled, options.fromBlock, options.maxResults);
      outputResult(results, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("search-direct")
  .description("Search questions (on-chain counter, free RPC compatible)")
  .option("--tags <tags:string>", "Tag filter")
  .option("--unsettled", "Unsettled only")
  .option("--max-results <n:number>", "Max results")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const results = await sdk.searchQuestionsDirect(options.tags, !!options.unsettled, options.maxResults);
      outputResult(results, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("batch-settle")
  .description("Batch settle expired questions (1 CKT keeper reward each)")
  .arguments("<question-ids:string>")
  .action(async (options: any, questionIds: string) => {
    try {
      const ids = questionIds.split(",").map((id) => {
        const n = Number(id.trim());
        if (!Number.isInteger(n) || n < 0) {
          throw new Error(`Invalid question ID: "${id.trim()}"`);
        }
        return n;
      });
      const sdk = await createSDK(options);
      const result = await sdk.batchSettle(ids);
      outputResult(result, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
