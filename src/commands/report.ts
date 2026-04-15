import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const reportCommand = new Command()
  .description("レポート・モデレーション操作")
  .action(function () { this.showHelp(); })
  .command("submit")
  .description("コンテンツを報告する (1 CKT、Tier 1 以上)")
  .arguments("<content-type:string> <content-id:number> <reason:string>")
  .action(async (options: any, contentType: string, contentId: number, reason: string) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.submitReport(contentType, contentId, reason);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("dispute")
  .description("虚偽報告に反論する (Tier 1 以上、無料)")
  .arguments("<report-id:number>")
  .action(async (options: any, reportId: number) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.disputeReport(reportId);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("auto-validate")
  .description("30日経過後の報告の自動検証")
  .arguments("<report-id:number>")
  .action(async (options: any, reportId: number) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.autoValidateReport(reportId);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
