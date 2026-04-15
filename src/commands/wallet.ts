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
  .description("ウォレット管理")
  .action(function () { this.showHelp(); })
  .command("add")
  .description("ウォレットを追加する")
  .arguments("<name:string>")
  .option("--private-key", "対話的に秘密鍵を入力する")
  .option("--private-key-env <envVar:string>", "環境変数から秘密鍵を取得する")
  .action(async (options: any, name: string) => {
    try {
      let pk: string;
      if (options.privateKeyEnv) {
        const envValue = process.env[options.privateKeyEnv];
        if (!envValue) throw new Error(`環境変数 '${options.privateKeyEnv}' が設定されていません`);
        pk = envValue;
      } else {
        pk = await readSecretInput("秘密鍵を入力: ");
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
  .description("登録済みウォレット一覧を表示する")
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
  .description("ウォレットを削除する")
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
  .description("デフォルトウォレットを設定する")
  .arguments("<name:string>")
  .action(async (options: any, name: string) => {
    try {
      const wallets = await listWallets();
      if (!wallets.some((w) => w.name === name)) {
        throw new Error(`ウォレット '${name}' が見つかりません`);
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
  .description("秘密鍵を表示する (要マスターパスワード確認)")
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
