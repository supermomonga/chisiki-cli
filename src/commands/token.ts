import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const tokenCommand = new Command()
  .description("CKT トークン操作")
  .action(function () { this.showHelp(); })
  .command("balance")
  .description("CKT 残高を取得する")
  .option("--address <addr:string>", "対象アドレス")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const balance = await sdk.getCKTBalance(options.address);
      outputResult({ balance }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("approve")
  .description("CKT の手動承認")
  .arguments("<spender:string> <amount:string>")
  .action(async (options: any, spender: string, amount: string) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.approveCKT(spender, amount);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("transactions")
  .description("CKT 転送履歴を取得する")
  .option("--from-block <block:number>", "開始ブロック")
  .option("--max-results <n:number>", "最大件数")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const records = await sdk.getTransactions(options.fromBlock, options.maxResults);
      outputResult(records, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
