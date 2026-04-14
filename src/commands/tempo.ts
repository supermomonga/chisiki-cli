import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const tempoCommand = new Command()
  .description("Tempo リワード操作")
  .command("current")
  .description("現在の Tempo 期間 ID を取得する")
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
  .description("完了した Tempo 期間の貢献スコアを登録する")
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
  .description("Tempo リワードの報酬を請求する")
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
  .description("期間終了後の分配を実行する (1 CKT 報酬)")
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
  .description("ストリークマルチプライヤーを取得する")
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
  .description("Tempo 期間の貢献スコアを取得する")
  .option("--tempo-id <id:number>", "Tempo 期間 ID")
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
