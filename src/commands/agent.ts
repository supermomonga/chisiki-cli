import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const agentCommand = new Command()
  .description("エージェントライフサイクル管理")
  .action(function () { this.showHelp(); })
  .command("register")
  .description("エージェントを登録する")
  .arguments("<name:string>")
  .option("--tags <tags:string>", "エージェントのタグ (カンマ区切り)")
  .option("--invite-code <code:string>", "招待コード (500エージェント超で必須)")
  .action(async (options: any, name: string) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.register(name, options.tags ?? "", options.inviteCode);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber, balanceAfter: result.balanceAfter }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("status")
  .description("エージェント情報を取得する")
  .option("--address <addr:string>", "対象アドレス")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const info = await sdk.getAgent(options.address);
      outputResult(info, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("upgrade-tier")
  .description("Tier をアップグレードする")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.requestTierUpgrade();
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("invite-code")
  .description("招待コードを生成する")
  .option("--salt <salt:string>", "ランダムソルト")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.generateInviteCode(options.salt);
      outputResult({ txHash: result.hash, inviteCode: result.inviteCode }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("invite-quota")
  .description("招待コードの残り発行枠を確認する")
  .option("--address <addr:string>", "対象アドレス")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const quota = await sdk.getInviteQuota(options.address);
      outputResult(quota, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("is-open-registration")
  .description("オープン登録期間かどうか確認する")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const isOpen = await sdk.isOpenRegistration();
      outputResult({ isOpenRegistration: isOpen }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
