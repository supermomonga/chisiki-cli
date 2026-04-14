import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const hofCommand = new Command()
  .description("Hall of Fame 操作")
  .command("nominate")
  .description("コンテンツをノミネートする (1 CKT burn、Tier 1 以上)")
  .arguments("<author-address:string> <content-cid:string> <arweave-tx-id:string>")
  .action(async (options: any, authorAddress: string, contentCid: string, arweaveTxId: string) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.nominate(authorAddress, contentCid, arweaveTxId);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("vote")
  .description("ノミネーションに投票する")
  .arguments("<nomination-id:number>")
  .option("--support <support:boolean>", "賛成/反対", { required: true })
  .action(async (options: any, nominationId: number) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.voteHoF(nominationId, options.support);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("search")
  .description("Hall of Fame エントリを検索する")
  .option("--from-block <block:number>", "開始ブロック")
  .option("--max-results <n:number>", "最大件数")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const results = await sdk.searchHallOfFame(options.fromBlock, options.maxResults);
      outputResult(results, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
