import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { parse, stringify } from "smol-toml";
import type { AppConfig, WalletConfig } from "../types/index.js";

const CONFIG_DIR = join(homedir(), ".config", "chisiki-cli");
const CONFIG_FILE = join(CONFIG_DIR, "config.toml");

const DEFAULT_CONFIG: AppConfig = {
  default: {
    wallet: "main",
    rpc_url: "https://mainnet.base.org",
    chain_id: 8453,
  },
  wallet: {},
};

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

export async function loadConfig(): Promise<AppConfig> {
  if (!existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG, wallet: {} };
  }
  const content = await readFile(CONFIG_FILE, "utf-8");
  const parsed = parse(content);
  const def = parsed.default as any;
  return {
    default: {
      wallet: String(def?.wallet ?? DEFAULT_CONFIG.default.wallet),
      rpc_url: String(def?.rpc_url ?? DEFAULT_CONFIG.default.rpc_url),
      chain_id: Number(def?.chain_id ?? DEFAULT_CONFIG.default.chain_id),
      ...(def?.salt_idempotency !== undefined && { salt_idempotency: Boolean(def.salt_idempotency) }),
      ...(def?.salt_seed !== undefined && { salt_seed: String(def.salt_seed) }),
    },
    wallet: (parsed.wallet as unknown as Record<string, WalletConfig>) ?? {},
  };
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await ensureConfigDir();
  const content = stringify(config as any);
  await writeFile(CONFIG_FILE, content, "utf-8");
}

export async function initConfig(force: boolean): Promise<void> {
  if (existsSync(CONFIG_FILE) && !force) {
    throw new Error(`Config file already exists: ${CONFIG_FILE}\nUse --force to overwrite`);
  }
  await saveConfig(DEFAULT_CONFIG);
}

export function resolveRpcUrl(cliOpt?: string): string {
  if (cliOpt) return cliOpt;
  if (process.env.CHISIKI_RPC_URL) return process.env.CHISIKI_RPC_URL;
  return "https://mainnet.base.org";
}

export function resolveChainId(cliOpt?: number): number {
  if (cliOpt !== undefined) return cliOpt;
  if (process.env.CHISIKI_CHAIN_ID) return Number(process.env.CHISIKI_CHAIN_ID);
  return 8453;
}

export async function resolveWalletName(cliOpt?: string): Promise<string> {
  if (cliOpt) return cliOpt;
  if (process.env.CHISIKI_WALLET) return process.env.CHISIKI_WALLET;
  const config = await loadConfig();
  return config.default.wallet;
}
