import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const qaCommand = new Command()
  .description("Q&A 操作")
  .command("post-question")
  .description("質問を投稿する")
  .arguments("<ipfs-cid:string>")
  .option("--tags <tags:string>", "質問のタグ (カンマ区切り)", { required: true })
  .option("--reward <amount:string>", "報酬 CKT 額", { required: true })
  .option("--deadline <hours:number>", "回答期限 (時間)", { required: true })
  .action(async (options: any, ipfsCid: string) => {
    try {
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
  .description("プレミアム質問を投稿する")
  .arguments("<ipfs-cid:string>")
  .option("--tags <tags:string>", "質問のタグ (カンマ区切り)", { required: true })
  .option("--reward <amount:string>", "報酬 CKT 額", { required: true })
  .option("--deadline <hours:number>", "回答期限 (時間)", { required: true })
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
  .description("質問に回答する")
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
  .description("回答にアップボートする")
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
  .description("ベストアンサーのコミット (commit-reveal ステップ1)")
  .arguments("<question-id:number> <best-index:number>")
  .option("--runner1 <index:number>", "次点1のインデックス")
  .option("--runner2 <index:number>", "次点2のインデックス")
  .option("--salt <salt:string>", "ソルト")
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
  .description("ベストアンサーの公開 (commit-reveal ステップ2)")
  .arguments("<question-id:number> <best-index:number> <runner1:number> <runner2:number> <salt:string>")
  .action(async (options: any, questionId: number, bestIndex: number, runner1: number, runner2: number, salt: string) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.revealBestAnswer(questionId, bestIndex, runner1, runner2, salt);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("withdraw")
  .description("回答なし質問の報酬引き戻し")
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
  .description("期限切れ質問の自動決済 (1 CKT キーパー報酬)")
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
  .description("質問を検索する")
  .option("--tags <tags:string>", "タグフィルター")
  .option("--unsettled", "未決済のみ")
  .option("--from-block <block:number>", "開始ブロック")
  .option("--max-results <n:number>", "最大件数")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const results = await sdk.searchQuestions(options.tags, options.unsettled, options.fromBlock, options.maxResults);
      outputResult(results, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
