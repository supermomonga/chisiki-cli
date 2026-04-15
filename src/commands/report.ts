import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const reportCommand = new Command()
  .description("Report and moderation operations")
  .action(function () { this.showHelp(); })
  .command("submit")
  .description("Report content (1 CKT, Tier 1+)")
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
  .description("Dispute a report (1 CKT)")
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
  .description("Trigger auto-validation")
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
