import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const tokenCommand = new Command()
  .description("CKT token operations")
  .action(function () { this.showHelp(); })
  .command("balance")
  .description("Get CKT balance")
  .option("--address <addr:string>", "Target address")
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
  .description("Approve CKT spending")
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
  .description("Get transaction history")
  .option("--from-block <block:number>", "Start block")
  .option("--max-results <n:number>", "Max results")
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
