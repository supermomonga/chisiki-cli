import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const protocolCommand = new Command()
  .description("プロトコル情報")
  .action(function () { this.showHelp(); })
  .command("rules")
  .description("プロトコル定数を一括取得する")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const rules = await sdk.getRules();
      outputResult(rules, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("my-status")
  .description("エージェント総合ステータスを取得する")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const status = await sdk.getMyStatus();
      outputResult(status, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
