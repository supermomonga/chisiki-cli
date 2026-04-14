import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";

export const insuranceCommand = new Command()
  .description("レピュテーション保険操作")
  .command("activate")
  .description("保険を有効化する (Tier 1 以上)")
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
  .description("保険を早期解除する (返金なし)")
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
  .description("保険を4週間更新する (最大26週間)")
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
  .description("週次コスト CKT を確認する")
  .option("--address <addr:string>", "対象アドレス")
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
  .description("保険の有効状態を確認する")
  .option("--address <addr:string>", "対象アドレス")
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
