import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const knowledgeCommand = new Command()
  .description("ナレッジストア操作")
  .action(function () { this.showHelp(); })
  .command("list")
  .description("ナレッジを出品する")
  .arguments("<title:string>")
  .option("--tags <tags:string>", "タグ (カンマ区切り)", { required: true })
  .option("--price <amount:string>", "価格 CKT", { required: true })
  .option("--ipfs-cid <cid:string>", "コンテンツ CID", { required: true })
  .option("--content-hash <hash:string>", "コンテンツハッシュ", { required: true })
  .action(async (options: any, title: string) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.listKnowledge(title, options.tags, options.price, options.ipfsCid, options.contentHash);
      outputResult({ txHash: result.hash, knowledgeId: result.knowledgeId, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("purchase")
  .description("ナレッジを購入する")
  .arguments("<knowledge-id:number>")
  .action(async (options: any, knowledgeId: number) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.purchase(knowledgeId);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("deliver")
  .description("購入者にナレッジを配信する")
  .arguments("<purchase-id:number>")
  .action(async (options: any, purchaseId: number) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.deliverKnowledge(purchaseId);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("claim-undelivered")
  .description("未配信ナレッジの返金請求")
  .arguments("<purchase-id:number>")
  .action(async (options: any, purchaseId: number) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.claimUndelivered(purchaseId);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("get")
  .description("ナレッジ情報を取得する")
  .arguments("<knowledge-id:number>")
  .action(async (options: any, knowledgeId: number) => {
    try {
      const sdk = await createSDK(options);
      const info = await sdk.getKnowledge(knowledgeId);
      outputResult(info, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("get-purchase")
  .description("購入情報を取得する")
  .arguments("<purchase-id:number>")
  .action(async (options: any, purchaseId: number) => {
    try {
      const sdk = await createSDK(options);
      const info = await sdk.getPurchase(purchaseId);
      outputResult(info, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("search")
  .description("ナレッジを検索する")
  .option("--tags <tags:string>", "タグフィルター")
  .option("--from-block <block:number>", "開始ブロック")
  .option("--max-results <n:number>", "最大件数")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const results = await sdk.searchKnowledge(options.tags, options.fromBlock, options.maxResults);
      outputResult(results, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("review")
  .description("購入のレビューを投稿する")
  .arguments("<purchase-id:number>")
  .option("--product-score <score:number>", "プロダクトスコア (1-5)", { required: true })
  .option("--seller-score <score:number>", "セラースコア (1-5)", { required: true })
  .action(async (options: any, purchaseId: number) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.submitReview(purchaseId, options.productScore, options.sellerScore);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("auto-review")
  .description("30日経過後の自動レビュー")
  .arguments("<purchase-id:number>")
  .action(async (options: any, purchaseId: number) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.triggerAutoReview(purchaseId);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
