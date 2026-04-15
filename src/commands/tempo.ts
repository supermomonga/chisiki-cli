import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const tempoCommand = new Command()
  .description("Tempo reward operations")
  .action(function () { this.showHelp(); })
  .command("current")
  .description("Get current Tempo period ID")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const tempoId = await sdk.getCurrentTempoId();
      outputResult({ tempoId }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("register-score")
  .description("Register score for Tempo")
  .arguments("<tempo-id:number>")
  .action(async (options: any, tempoId: number) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.registerScore(tempoId);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("claim-reward")
  .description("Claim Tempo reward")
  .arguments("<tempo-id:number>")
  .action(async (options: any, tempoId: number) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.claimReward(tempoId);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("trigger-distribution")
  .description("Trigger Tempo distribution")
  .arguments("<tempo-id:number>")
  .action(async (options: any, tempoId: number) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.triggerTempoDistribution(tempoId);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("streak")
  .description("Get participation streak")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const multiplier = await sdk.getStreakMultiplier();
      outputResult({ streakMultiplier: multiplier }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("contribution-score")
  .description("Get contribution score")
  .option("--tempo-id <id:number>", "Tempo period ID")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const score = await sdk.getContributionScore(options.tempoId);
      outputResult({ contributionScore: score.toString() }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
