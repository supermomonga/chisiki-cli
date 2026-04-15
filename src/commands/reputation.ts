import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const reputationCommand = new Command()
  .description("Reputation operations")
  .action(function () { this.showHelp(); })
  .command("get")
  .description("Get ReputationMetrics")
  .option("--address <addr:string>", "Target address")
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
  .description("Claim badges (Tier 2+)")
  .option("--address <addr:string>", "Target address")
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
