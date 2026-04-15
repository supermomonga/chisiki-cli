import { Command } from "@cliffy/command";
import { initConfig, getConfigPath } from "../lib/config.js";
import { initWalletFile, getWalletFilePath } from "../lib/wallet-store.js";
import { outputResult, outputError } from "../lib/output.js";

export const initCommand = new Command()
  .description("Initialize config and wallet files")
  .option("--force", "Overwrite existing files")
  .action(async (options: any) => {
    try {
      const force = options.force ?? false;
      await initConfig(force);
      await initWalletFile(force);
      outputResult({
        configPath: getConfigPath(),
        walletPath: getWalletFilePath(),
      }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
