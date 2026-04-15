import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const knowledgeCommand = new Command()
  .description("Knowledge store operations")
  .action(function () { this.showHelp(); })
  .command("list")
  .description("List knowledge for sale")
  .arguments("<title:string>")
  .option("--tags <tags:string>", "Tags (comma-separated)", { required: true })
  .option("--price <amount:string>", "Price (CKT)", { required: true })
  .option("--ipfs-cid <cid:string>", "Content CID", { required: true })
  .option("--content-hash <hash:string>", "Content hash", { required: true })
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
  .description("Purchase knowledge")
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
  .description("Deliver knowledge to buyer")
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
  .description("Claim refund for undelivered knowledge")
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
  .description("Get knowledge info")
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
  .description("Get purchase info")
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
  .description("Search knowledge")
  .option("--tags <tags:string>", "Tag filter")
  .option("--from-block <block:number>", "Start block")
  .option("--max-results <n:number>", "Max results")
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
  .description("Submit a purchase review")
  .arguments("<purchase-id:number>")
  .option("--product-score <score:number>", "Product score (1-5)", { required: true })
  .option("--seller-score <score:number>", "Seller score (1-5)", { required: true })
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
  .description("Auto-review after 30 days")
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
