import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";
import { resolveSalt } from "../lib/salt.js";

// CIDv0: base58btc, always "Qm" + 44 chars from the base58 alphabet
const CID_V0 = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
// CIDv1 (base32 lowercase, the common multibase for IPFS): "b" + base32 chars.
// Minimum length covers sha-256 dag-pb (~59 chars); accept longer for larger multihashes.
const CID_V1 = /^b[a-z2-7]{50,}$/;

const URL_HEAD_TIMEOUT_MS = 5_000;

async function assertContentRef(input: string): Promise<void> {
  // http(s) URL: verify reachability with HEAD
  // TODO: detect whether the URL is an IPFS gateway (e.g. https://ipfs.io/ipfs/<cid>,
  // https://<cid>.ipfs.dweb.link, https://w3s.link/ipfs/<cid>) and extract+validate the
  // embedded CID so gateway URLs get the same format guarantees as bare CIDs.
  if (input.startsWith("http://") || input.startsWith("https://")) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), URL_HEAD_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(input, { method: "HEAD", redirect: "follow", signal: controller.signal });
    } catch (e: any) {
      const reason = e?.name === "AbortError" ? `timeout after ${URL_HEAD_TIMEOUT_MS}ms` : (e?.message ?? String(e));
      throw new Error(`URL not reachable: ${input} (${reason})`);
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      throw new Error(`URL not reachable: HEAD ${input} returned ${res.status}`);
    }
    return;
  }

  // IPFS CID (with optional ipfs:// prefix): format check only
  const cid = input.startsWith("ipfs://") ? input.slice("ipfs://".length) : input;
  if (!CID_V0.test(cid) && !CID_V1.test(cid)) {
    throw new Error(`Invalid content: expected IPFS CID (Qm.../b...) or http(s) URL, got "${input}"`);
  }
}

export const qaCommand = new Command()
  .description("Q&A operations")
  .action(function () { this.showHelp(); })
  .command("post-question")
  .description("Post a question")
  .arguments("<content:string>")
  .option("--tags <tags:string>", "Question tags (comma-separated)", { required: true })
  .option("--reward <amount:string>", "Reward amount (CKT)", { required: true })
  .option("--deadline <hours:number>", "Answer deadline (hours)", { required: true })
  .action(async (options: any, content: string) => {
    try {
      await assertContentRef(content);
      const sdk = await createSDK(options);
      const result = await sdk.postQuestion(content, options.tags, options.reward, options.deadline);
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
      const salt = await resolveSalt(options.salt, questionId, bestIndex, options.runner1, options.runner2);
      const sdk = await createSDK(options);
      const result = await sdk.commitBestAnswer(questionId, bestIndex, options.runner1, options.runner2, salt);
      outputResult({ hash: result.hash, salt: result.salt, bestIdx: result.bestIdx, runner1: result.runner1, runner2: result.runner2 }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("reveal-best")
  .description("Reveal best answer (commit-reveal step 2)")
  .arguments("<question-id:number> <best-index:number>")
  .option("--runner1 <index:number>", "Runner-up 1 index")
  .option("--runner2 <index:number>", "Runner-up 2 index")
  .option("--salt <salt:string>", "Salt (required unless salt-idempotency is enabled)")
  .action(async (options: any, questionId: number, bestIndex: number) => {
    try {
      const { ethers } = await import("ethers");
      let saltBytes32: string;
      if (options.salt) {
        // Explicit --salt: if already a 0x-prefixed bytes32 hex, use as-is; otherwise hash it
        saltBytes32 = /^0x[0-9a-fA-F]{64}$/.test(options.salt)
          ? options.salt
          : ethers.keccak256(ethers.toUtf8Bytes(options.salt));
      } else {
        const resolvedSalt = await resolveSalt(undefined, questionId, bestIndex, options.runner1, options.runner2);
        if (!resolvedSalt) {
          throw new Error("Salt is required. Provide --salt or enable salt-idempotency:\n  chisiki config set default.salt_idempotency true");
        }
        // Idempotent salt is a plain string — apply the same keccak256 transform as commitBestAnswer
        saltBytes32 = ethers.keccak256(ethers.toUtf8Bytes(resolvedSalt));
      }
      const sdk = await createSDK(options);
      const r1 = options.runner1 != null ? BigInt(options.runner1) : ethers.MaxUint256;
      const r2 = options.runner2 != null ? BigInt(options.runner2) : ethers.MaxUint256;
      const result = await sdk.revealBestAnswer(questionId, bestIndex, r1, r2, saltBytes32);
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
