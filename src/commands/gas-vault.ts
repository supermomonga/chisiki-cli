import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const gasVaultCommand = new Command()
  .description("Gas Vault operations (deposit CKT for gas refunds)")
  .action(function () { this.showHelp(); })

  .command("deposit")
  .description("Deposit CKT into Gas Vault (one-way, no withdrawals)")
  .arguments("<amount:string>")
  .action(async (options: any, amount: string) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.depositGasVault(amount);
      outputResult({ txHash: result.hash, blockNumber: result.blockNumber }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })

  .reset()
  .command("balance")
  .description("Get available CKT balance in Gas Vault")
  .option("--address <addr:string>", "Target address")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const balance = await sdk.getGasVaultBalance(options.address);
      outputResult({ balance }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
