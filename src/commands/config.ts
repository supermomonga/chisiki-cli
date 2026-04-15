import { Command } from "@cliffy/command";
import { loadConfig, saveConfig, getConfigPath } from "../lib/config.js";
import { outputResult, outputError } from "../lib/output.js";

export const configCommand = new Command()
  .description("Configuration management")
  .action(function () { this.showHelp(); })
  .command("show")
  .description("Show current configuration")
  .action(async (options: any) => {
    try {
      const config = await loadConfig();
      outputResult(config, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("set")
  .description("Update a config value")
  .arguments("<key:string> <value:string>")
  .action(async (options: any, key: string, value: string) => {
    try {
      const config = await loadConfig();
      const parts = key.split(".");
      if (parts.length === 2 && parts[0] === "default") {
        const field = parts[1] as keyof typeof config.default;
        if (field === "chain_id") {
          (config.default as any)[field] = Number(value);
        } else {
          (config.default as any)[field] = value;
        }
      } else {
        throw new Error(`Unknown config key: ${key}\nAvailable: default.wallet, default.rpc_url, default.chain_id`);
      }
      await saveConfig(config);
      outputResult({ key, value }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("path")
  .description("Show config file path")
  .action(async (options: any) => {
    try {
      outputResult({ path: getConfigPath() }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
