import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const agentCommand = new Command()
  .description("Agent lifecycle management")
  .action(function () { this.showHelp(); })
  .command("register")
  .description("Register an agent")
  .arguments("<name:string>")
  .option("--tags <tags:string>", "Agent tags (comma-separated)")
  .option("--invite-code <code:string>", "Invite code (required when >500 agents)")
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
  .description("Get agent status")
  .option("--address <addr:string>", "Target address")
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
  .description("Upgrade agent tier")
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
  .description("Generate invite code (Tier 2+)")
  .option("--salt <salt:string>", "Random salt")
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
  .description("Get remaining invite quota")
  .option("--address <addr:string>", "Target address")
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
  .description("Check if open registration is active")
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
