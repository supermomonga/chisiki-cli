import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const reputationCommand = new Command()
  .description("レピュテーション操作")
  .command("get")
  .description("ReputationMetrics を取得する")
  .option("--address <addr:string>", "対象アドレス")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const metrics = await sdk.getReputation(options.address);
      outputResult(metrics, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("claim-badges")
  .description("実績に基づくバッジの自動付与")
  .option("--address <addr:string>", "対象アドレス")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.claimBadges(options.address);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
