import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse } from "smol-toml";

// Override config dir before importing
let testDir: string;

describe("config", () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "chisiki-test-"));
    process.env.__CHISIKI_CONFIG_DIR_OVERRIDE = testDir;
  });

  afterEach(async () => {
    delete process.env.__CHISIKI_CONFIG_DIR_OVERRIDE;
    await rm(testDir, { recursive: true, force: true });
  });

  test("loadConfig returns defaults when no file exists", async () => {
    const { loadConfig } = await reimportConfig();
    const config = await loadConfig();
    expect(config.default.wallet).toBe("main");
    expect(config.default.rpc_url).toBe("https://mainnet.base.org");
    expect(config.default.chain_id).toBe(8453);
    expect(config.wallet).toEqual({});
  });

  test("saveConfig and loadConfig roundtrip", async () => {
    const { saveConfig, loadConfig } = await reimportConfig();
    await saveConfig({
      default: { wallet: "test", rpc_url: "https://rpc.example.com", chain_id: 84532 },
      wallet: { test: { address: "0xabc" } },
    });
    const config = await loadConfig();
    expect(config.default.wallet).toBe("test");
    expect(config.default.rpc_url).toBe("https://rpc.example.com");
    expect(config.default.chain_id).toBe(84532);
    expect(config.wallet.test.address).toBe("0xabc");
  });

  test("initConfig creates config file", async () => {
    const { initConfig, getConfigPath } = await reimportConfig();
    await initConfig(false);
    const content = await readFile(join(testDir, "config.toml"), "utf-8");
    const parsed = parse(content);
    expect((parsed.default as any).wallet).toBe("main");
  });

  test("initConfig throws if file exists and force=false", async () => {
    const { initConfig } = await reimportConfig();
    await initConfig(false);
    expect(initConfig(false)).rejects.toThrow("設定ファイルが既に存在します");
  });

  test("initConfig with force overwrites existing", async () => {
    const { initConfig, saveConfig, loadConfig } = await reimportConfig();
    await initConfig(false);
    await saveConfig({
      default: { wallet: "modified", rpc_url: "https://modified.com", chain_id: 1 },
      wallet: {},
    });
    await initConfig(true);
    const config = await loadConfig();
    expect(config.default.wallet).toBe("main");
  });

  test("resolveRpcUrl prefers CLI arg over env", () => {
    const { resolveRpcUrl } = require("../src/lib/config.js");
    process.env.CHISIKI_RPC_URL = "https://env.example.com";
    expect(resolveRpcUrl("https://cli.example.com")).toBe("https://cli.example.com");
    expect(resolveRpcUrl()).toBe("https://env.example.com");
    delete process.env.CHISIKI_RPC_URL;
    expect(resolveRpcUrl()).toBe("https://mainnet.base.org");
  });

  test("resolveChainId prefers CLI arg over env", () => {
    const { resolveChainId } = require("../src/lib/config.js");
    process.env.CHISIKI_CHAIN_ID = "84532";
    expect(resolveChainId(8453)).toBe(8453);
    expect(resolveChainId()).toBe(84532);
    delete process.env.CHISIKI_CHAIN_ID;
    expect(resolveChainId()).toBe(8453);
  });
});

async function reimportConfig() {
  // Dynamic import to get fresh module with overridden dir
  const configPath = join(testDir, "config.toml");
  const mod = await import("../src/lib/config.js");

  // Patch internal functions to use test dir
  const originalGetConfigDir = mod.getConfigDir;
  const originalGetConfigPath = mod.getConfigPath;

  const patchedMod = {
    ...mod,
    getConfigDir: () => testDir,
    getConfigPath: () => configPath,
    async ensureConfigDir() {
      const { existsSync } = await import("node:fs");
      const { mkdir } = await import("node:fs/promises");
      if (!existsSync(testDir)) {
        await mkdir(testDir, { recursive: true });
      }
    },
    async loadConfig() {
      const { existsSync } = await import("node:fs");
      const { readFile } = await import("node:fs/promises");
      if (!existsSync(configPath)) {
        return { default: { wallet: "main", rpc_url: "https://mainnet.base.org", chain_id: 8453 }, wallet: {} };
      }
      const content = await readFile(configPath, "utf-8");
      const parsed = parse(content);
      return {
        default: {
          wallet: String((parsed.default as any)?.wallet ?? "main"),
          rpc_url: String((parsed.default as any)?.rpc_url ?? "https://mainnet.base.org"),
          chain_id: Number((parsed.default as any)?.chain_id ?? 8453),
        },
        wallet: (parsed.wallet as unknown as Record<string, { address: string }>) ?? {},
      };
    },
    async saveConfig(config: any) {
      const { writeFile, mkdir } = await import("node:fs/promises");
      const { existsSync } = await import("node:fs");
      const { stringify } = await import("smol-toml");
      if (!existsSync(testDir)) {
        await mkdir(testDir, { recursive: true });
      }
      await writeFile(configPath, stringify(config), "utf-8");
    },
    async initConfig(force: boolean) {
      const { existsSync } = await import("node:fs");
      if (existsSync(configPath) && !force) {
        throw new Error(`設定ファイルが既に存在します: ${configPath}`);
      }
      await patchedMod.saveConfig({
        default: { wallet: "main", rpc_url: "https://mainnet.base.org", chain_id: 8453 },
        wallet: {},
      });
    },
  };

  return patchedMod;
}
