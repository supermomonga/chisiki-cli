import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const insuranceCommand = new Command()
  .description("Reputation insurance operations")
  .action(function () { this.showHelp(); })
  .command("activate")
  .description("Activate insurance (Tier 1+)")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.activateInsurance();
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("deactivate")
  .description("Deactivate insurance")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.deactivateInsurance();
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("renew")
  .description("Renew insurance")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.renewInsurance();
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("cost")
  .description("Get insurance cost")
  .option("--address <addr:string>", "Target address")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const cost = await sdk.getInsuranceCost(options.address);
      outputResult({ costPerWeek: cost }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("status")
  .description("Get insurance status")
  .option("--address <addr:string>", "Target address")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const isActive = await sdk.isInsured(options.address);
      outputResult({ insured: isActive }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
