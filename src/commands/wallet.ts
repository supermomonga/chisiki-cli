import { Command } from "@cliffy/command";
import { addWallet, removeWallet, listWallets, exportPrivateKey } from "../lib/wallet-store.js";
import { loadConfig, saveConfig } from "../lib/config.js";
import { outputResult, outputError } from "../lib/output.js";
import type { GlobalOptions } from "../types/index.js";
import { createInterface } from "node:readline";

async function readSecretInput(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    process.stderr.write(prompt);
    rl.question("", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export const walletCommand = new Command()
  .description("Wallet management")
  .action(function () { this.showHelp(); })
  .command("add")
  .description("Add a wallet")
  .arguments("<name:string>")
  .option("--private-key", "Enter private key interactively")
  .option("--private-key-env <envVar:string>", "Read private key from environment variable")
  .action(async (options: any, name: string) => {
    try {
      let pk: string;
      if (options.privateKeyEnv) {
        const envValue = process.env[options.privateKeyEnv];
        if (!envValue) throw new Error(`Environment variable '${options.privateKeyEnv}' is not set`);
        pk = envValue;
      } else {
        pk = await readSecretInput("Enter private key: ");
      }
      const address = await addWallet(name, pk);
      outputResult({ name, address }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("list")
  .description("List registered wallets")
  .action(async (options: any) => {
    try {
      const wallets = await listWallets();
      const config = await loadConfig();
      const result = wallets.map((w) => ({
        ...w,
        default: w.name === config.default.wallet,
      }));
      outputResult(result, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("remove")
  .description("Remove a wallet")
  .arguments("<name:string>")
  .action(async (options: any, name: string) => {
    try {
      await removeWallet(name);
      outputResult({ removed: name }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("set-default")
  .description("Set the default wallet")
  .arguments("<name:string>")
  .action(async (options: any, name: string) => {
    try {
      const wallets = await listWallets();
      if (!wallets.some((w) => w.name === name)) {
        throw new Error(`Wallet '${name}' not found`);
      }
      const config = await loadConfig();
      config.default.wallet = name;
      await saveConfig(config);
      outputResult({ defaultWallet: name }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("export")
  .description("Export private key (requires master password)")
  .arguments("<name:string>")
  .action(async (options: any, name: string) => {
    try {
      const pk = await exportPrivateKey(name);
      outputResult({ name, privateKey: pk }, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
