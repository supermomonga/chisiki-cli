import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import {
  startAnvil, stopAnvil, snapshot, revert, increaseTime,
  fundCKT, preApproveCKT, setupCliConfig, runCli, getConfigDir,
  TEST_ACCOUNTS, getProvider,
} from "./helpers";

const E2E_TIMEOUT = 30_000;

function uniqueCID(prefix: string = "Qm"): string {
  return prefix + randomBytes(16).toString("hex");
}

describe("E2E (anvil fork)", () => {
  // Block number after setup — used for event log queries
  let setupBlock: number;
  let snapshotId: string;

  beforeAll(async () => {
    await startAnvil();
    await setupCliConfig();
    await fundCKT(TEST_ACCOUNTS[0].address, "10000");
    await fundCKT(TEST_ACCOUNTS[1].address, "10000");

    // Pre-approve CKT for all contracts to avoid nonce race in SDK (approve + action)
    await preApproveCKT(TEST_ACCOUNTS[0].pk);
    await preApproveCKT(TEST_ACCOUNTS[1].pk);

    // Pre-register both agents so each test doesn't pay the 4s cost
    await runCli("agent", "register", "main-agent", "--tags", "e2e,testing");
    await runCli("--wallet", "sub", "agent", "register", "sub-agent", "--tags", "e2e,testing");

    // Record block number for scoped event queries
    const provider = getProvider();
    setupBlock = await provider.getBlockNumber();
  }, 120_000);

  afterAll(async () => {
    await stopAnvil();
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
    // Re-apply CLI config to ensure consistent state (evm_revert doesn't touch filesystem)
    await setupCliConfig();
  });

  afterEach(async () => {
    await revert(snapshotId);
  });

  // ═══════════════════════════════════════════════════════════
  //  Config & Wallet (local)
  // ═══════════════════════════════════════════════════════════

  describe("config", () => {
    test("config show returns current config", async () => {
      const { json, exitCode } = await runCli("config", "show");
      expect(exitCode).toBe(0);
      expect(json.default.wallet).toBe("main");
      expect(json.default.rpc_url).toContain("127.0.0.1");
      expect(json.default.chain_id).toBe(8453);
    }, E2E_TIMEOUT);

    test("config path returns config.toml path", async () => {
      const { json, exitCode } = await runCli("config", "path");
      expect(exitCode).toBe(0);
      expect(json.path).toContain("config.toml");
    }, E2E_TIMEOUT);

    test("config set updates a value", async () => {
      await runCli("config", "set", "default.chain_id", "84532");
      const { json } = await runCli("config", "show");
      expect(json.default.chain_id).toBe(84532);
    }, E2E_TIMEOUT);
  });

  describe("wallet", () => {
    test("wallet list returns registered wallets", async () => {
      const { json, exitCode } = await runCli("wallet", "list");
      expect(exitCode).toBe(0);
      expect(json).toBeArray();
      expect(json.map((w: any) => w.name)).toContain("main");
      expect(json.map((w: any) => w.name)).toContain("sub");
    }, E2E_TIMEOUT);

    test("wallet list shows default flag", async () => {
      const { json } = await runCli("wallet", "list");
      expect(json.find((w: any) => w.name === "main").default).toBe(true);
    }, E2E_TIMEOUT);

    test("wallet set-default changes default wallet", async () => {
      await runCli("wallet", "set-default", "sub");
      const { json } = await runCli("wallet", "list");
      expect(json.find((w: any) => w.name === "sub").default).toBe(true);
    }, E2E_TIMEOUT);

    test("wallet export returns private key", async () => {
      const { json, exitCode } = await runCli("wallet", "export", "main");
      expect(exitCode).toBe(0);
      expect(json.privateKey).toBe(TEST_ACCOUNTS[0].pk);
    }, E2E_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════
  //  Protocol
  // ═══════════════════════════════════════════════════════════

  describe("protocol", () => {
    test("protocol rules returns protocol constants", async () => {
      const { json, exitCode } = await runCli("protocol", "rules");
      expect(exitCode).toBe(0);
      expect(json).toHaveProperty("dailyAnswerLimit");
      expect(json).toHaveProperty("tempoDuration");
      expect(json).toHaveProperty("maxSupply");
      expect(json).toHaveProperty("tier1Burn");
    }, E2E_TIMEOUT);

    test("protocol my-status returns registered status", async () => {
      const { json, exitCode } = await runCli("protocol", "my-status");
      expect(exitCode).toBe(0);
      expect(json.address).toBe(TEST_ACCOUNTS[0].address);
      expect(json.registered).toBe(true);
      expect(json.name).toBe("main-agent");
      expect(json).toHaveProperty("cktBalance");
      expect(json).toHaveProperty("streakMultiplier");
    }, E2E_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════
  //  Token
  // ═══════════════════════════════════════════════════════════

  describe("token", () => {
    test("token balance returns CKT balance", async () => {
      const { json, exitCode } = await runCli("token", "balance");
      expect(exitCode).toBe(0);
      expect(Number(json.balance)).toBeGreaterThan(0);
    }, E2E_TIMEOUT);

    test("token balance --address for specific address", async () => {
      const { json, exitCode } = await runCli("token", "balance", "--address", TEST_ACCOUNTS[1].address);
      expect(exitCode).toBe(0);
      expect(Number(json.balance)).toBeGreaterThan(0);
    }, E2E_TIMEOUT);

    test("token approve returns txHash", async () => {
      const { json, exitCode } = await runCli("token", "approve", TEST_ACCOUNTS[1].address, "100");
      expect(exitCode).toBe(0);
      expect(json.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    }, E2E_TIMEOUT);

    test("token transactions with --from-block returns array", async () => {
      const { json, exitCode } = await runCli("token", "transactions", "--from-block", String(setupBlock - 5), "--max-results", "5");
      expect(exitCode).toBe(0);
      expect(json).toBeArray();
    }, E2E_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════
  //  Agent Lifecycle
  // ═══════════════════════════════════════════════════════════

  describe("agent", () => {
    test("agent is-open-registration returns boolean", async () => {
      const { json, exitCode } = await runCli("agent", "is-open-registration");
      expect(exitCode).toBe(0);
      expect(typeof json.isOpenRegistration).toBe("boolean");
    }, E2E_TIMEOUT);

    test("agent status returns registered agent info", async () => {
      const { json, exitCode } = await runCli("agent", "status");
      expect(exitCode).toBe(0);
      expect(json.exists).toBe(true);
      expect(json.name).toBe("main-agent");
      expect(json.tier).toBe(0);
    }, E2E_TIMEOUT);

    test("agent status --address for registered sub account", async () => {
      const { json, exitCode } = await runCli("agent", "status", "--address", TEST_ACCOUNTS[1].address);
      expect(exitCode).toBe(0);
      expect(json.exists).toBe(true);
      expect(json.name).toBe("sub-agent");
    }, E2E_TIMEOUT);

    test("agent invite-quota returns quota info", async () => {
      const { json, exitCode } = await runCli("agent", "invite-quota");
      expect(exitCode).toBe(0);
      expect(json).toHaveProperty("remaining");
      expect(json).toHaveProperty("total");
    }, E2E_TIMEOUT);

    test("duplicate registration returns E_DUP", async () => {
      const { exitCode, stderr } = await runCli("agent", "register", "another", "--tags", "testing");
      expect(exitCode).toBe(1);
      expect(stderr).toContain("E_DUP");
    }, E2E_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════
  //  Q&A Workflow
  // ═══════════════════════════════════════════════════════════

  describe("qa", () => {
    test("qa post-question posts a question", async () => {
      const r = await runCli(
        "qa", "post-question", uniqueCID(),
        "--tags", "testing", "--reward", "10", "--deadline", "24",
      );
      if (r.exitCode !== 0) console.log("QA POST-Q stderr:", r.stderr);
      expect(r.exitCode).toBe(0);
      expect(r.json.txHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(r.json.questionId).toBeGreaterThanOrEqual(0);
    }, E2E_TIMEOUT);

    test("qa post-premium-question posts premium question", async () => {
      const { json, exitCode } = await runCli(
        "qa", "post-premium-question", uniqueCID(),
        "--tags", "premium", "--reward", "20", "--deadline", "48",
      );
      expect(exitCode).toBe(0);
      expect(json).toHaveProperty("premiumBurned");
    }, E2E_TIMEOUT);

    test("qa post-answer answers a question", async () => {
      const qr = await runCli(
        "qa", "post-question", uniqueCID(),
        "--tags", "answer", "--reward", "10", "--deadline", "24",
      );
      expect(qr.exitCode).toBe(0);
      const { json, exitCode } = await runCli(
        "--wallet", "sub",
        "qa", "post-answer", String(qr.json.questionId), uniqueCID(),
      );
      expect(exitCode).toBe(0);
      expect(json.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    }, E2E_TIMEOUT);

    test("qa upvote upvotes an answer", async () => {
      const qr = await runCli("qa", "post-question", uniqueCID(), "--tags", "upvote", "--reward", "10", "--deadline", "24");
      await runCli("--wallet", "sub", "qa", "post-answer", String(qr.json.questionId), uniqueCID());
      const { json, exitCode } = await runCli("qa", "upvote", String(qr.json.questionId), "0");
      expect(exitCode).toBe(0);
      expect(json.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    }, E2E_TIMEOUT);

    test("qa commit-best and reveal-best settle a question", async () => {
      const qr = await runCli("qa", "post-question", uniqueCID(), "--tags", "cr", "--reward", "10", "--deadline", "24");
      await runCli("--wallet", "sub", "qa", "post-answer", String(qr.json.questionId), uniqueCID());

      const commitR = await runCli("qa", "commit-best", String(qr.json.questionId), "0");
      expect(commitR.exitCode).toBe(0);
      expect(commitR.json.salt).toBeDefined();
      // runner1/runner2 default to MaxUint256 string; pass through as-is
      const { salt, bestIdx } = commitR.json;
      const runner1 = String(commitR.json.runner1);
      const runner2 = String(commitR.json.runner2);

      // Advance time for commit-reveal delay
      await increaseTime(60);

      const revealR = await runCli("qa", "reveal-best", String(qr.json.questionId), String(bestIdx), runner1, runner2, salt);
      expect(revealR.exitCode).toBe(0);
      expect(revealR.json.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    }, E2E_TIMEOUT);

    test("qa withdraw reclaims reward after deadline", async () => {
      const qr = await runCli("qa", "post-question", uniqueCID(), "--tags", "wd", "--reward", "10", "--deadline", "1");
      expect(qr.exitCode).toBe(0);
      await increaseTime(3700);
      const { json, exitCode } = await runCli("qa", "withdraw", String(qr.json.questionId));
      expect(exitCode).toBe(0);
      expect(json.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    }, E2E_TIMEOUT);

    test("qa auto-settle settles expired question", async () => {
      const qr = await runCli("qa", "post-question", uniqueCID(), "--tags", "as", "--reward", "10", "--deadline", "1");
      const ar = await runCli("--wallet", "sub", "qa", "post-answer", String(qr.json.questionId), uniqueCID());
      expect(ar.exitCode).toBe(0);
      // Advance past deadline + grace period (1h deadline + 7d grace)
      await increaseTime(7 * 24 * 3600 + 7200);
      const r = await runCli("qa", "auto-settle", String(qr.json.questionId));
      if (r.exitCode !== 0) console.log("AUTO-SETTLE stderr:", r.stderr);
      expect(r.exitCode).toBe(0);
      expect(r.json.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    }, E2E_TIMEOUT);

    test("qa search with --from-block returns results", async () => {
      await runCli("qa", "post-question", uniqueCID(), "--tags", "srch", "--reward", "10", "--deadline", "24");
      const { json, exitCode } = await runCli("qa", "search", "--from-block", String(setupBlock), "--max-results", "5");
      expect(exitCode).toBe(0);
      expect(json).toBeArray();
      expect(json.length).toBeGreaterThanOrEqual(1);
    }, E2E_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════
  //  Knowledge Store
  // ═══════════════════════════════════════════════════════════

  describe("knowledge", () => {
    test("knowledge search with --from-block returns array", async () => {
      const { json, exitCode } = await runCli("knowledge", "search", "--from-block", String(setupBlock), "--max-results", "5");
      expect(exitCode).toBe(0);
      expect(json).toBeArray();
    }, E2E_TIMEOUT);

    test("knowledge list fails with E_TIER for Tier 0", async () => {
      const { exitCode, stderr } = await runCli(
        "knowledge", "list", "Test Knowledge",
        "--tags", "test", "--price", "10",
        "--ipfs-cid", uniqueCID(), "--content-hash", "0x" + randomBytes(32).toString("hex"),
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("E_TIER");
    }, E2E_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════
  //  Tempo
  // ═══════════════════════════════════════════════════════════

  describe("tempo", () => {
    test("tempo current returns current tempo ID", async () => {
      const { json, exitCode } = await runCli("tempo", "current");
      expect(exitCode).toBe(0);
      expect(typeof json.tempoId).toBe("number");
    }, E2E_TIMEOUT);

    test("tempo streak returns multiplier", async () => {
      const { json, exitCode } = await runCli("tempo", "streak");
      expect(exitCode).toBe(0);
      expect(json.streakMultiplier).toBeGreaterThanOrEqual(100);
    }, E2E_TIMEOUT);

    test("tempo contribution-score returns score", async () => {
      const { json, exitCode } = await runCli("tempo", "contribution-score");
      expect(exitCode).toBe(0);
      expect(json).toHaveProperty("contributionScore");
    }, E2E_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════
  //  Hall of Fame
  // ═══════════════════════════════════════════════════════════

  describe("hof", () => {
    test("hof search with --from-block returns array", async () => {
      const { json, exitCode } = await runCli("hof", "search", "--from-block", String(setupBlock), "--max-results", "5");
      expect(exitCode).toBe(0);
      expect(json).toBeArray();
    }, E2E_TIMEOUT);

    test("hof nominate fails with E_TIER for Tier 0", async () => {
      const { exitCode, stderr } = await runCli(
        "hof", "nominate", TEST_ACCOUNTS[1].address, uniqueCID(), "arweave-" + randomBytes(8).toString("hex"),
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("E_TIER");
    }, E2E_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════
  //  Reputation
  // ═══════════════════════════════════════════════════════════

  describe("reputation", () => {
    test("reputation get returns metrics", async () => {
      const { json, exitCode } = await runCli("reputation", "get");
      expect(exitCode).toBe(0);
      expect(json).toHaveProperty("weightedRating");
      expect(json).toHaveProperty("bestAnswerTotal");
      expect(json).toHaveProperty("totalTxns");
    }, E2E_TIMEOUT);

    test("reputation claim-badges returns txHash", async () => {
      const { json, exitCode } = await runCli("reputation", "claim-badges");
      expect(exitCode).toBe(0);
      expect(json.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    }, E2E_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════
  //  Insurance
  // ═══════════════════════════════════════════════════════════

  describe("insurance", () => {
    test("insurance status returns boolean", async () => {
      const { json, exitCode } = await runCli("insurance", "status");
      expect(exitCode).toBe(0);
      expect(typeof json.insured).toBe("boolean");
    }, E2E_TIMEOUT);

    test("insurance cost returns weekly cost", async () => {
      const { json, exitCode } = await runCli("insurance", "cost");
      expect(exitCode).toBe(0);
      expect(json).toHaveProperty("costPerWeek");
    }, E2E_TIMEOUT);

    test("insurance activate fails with E_TIER for Tier 0", async () => {
      const { exitCode, stderr } = await runCli("insurance", "activate");
      expect(exitCode).toBe(1);
      expect(stderr).toContain("E_TIER");
    }, E2E_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════
  //  Report
  // ═══════════════════════════════════════════════════════════

  describe("report", () => {
    test("report submit fails with E_TIER for Tier 0", async () => {
      const { exitCode, stderr } = await runCli("report", "submit", "question", "1", "spam");
      expect(exitCode).toBe(1);
      expect(stderr).toContain("E_TIER");
    }, E2E_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════
  //  Output format flags
  // ═══════════════════════════════════════════════════════════

  describe("output formats", () => {
    test("--pretty outputs formatted JSON", async () => {
      const { stdout, exitCode } = await runCli("token", "balance", "--pretty");
      expect(exitCode).toBe(0);
      expect(stdout).toContain('"balance"');
    }, E2E_TIMEOUT);

    test("--quiet suppresses output", async () => {
      const { stdout, exitCode } = await runCli("token", "balance", "--quiet");
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe("");
    }, E2E_TIMEOUT);

    test("--human outputs table format", async () => {
      const { stdout, exitCode } = await runCli("token", "balance", "--human");
      expect(exitCode).toBe(0);
      expect(stdout).toContain("balance");
      expect(stdout).toMatch(/[┌┐└┘│─]/);
    }, E2E_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════
  //  Multi-wallet
  // ═══════════════════════════════════════════════════════════

  describe("multi-wallet", () => {
    test("--wallet sub uses second account", async () => {
      const { json: mainBal } = await runCli("token", "balance");
      const { json: subBal } = await runCli("--wallet", "sub", "token", "balance");
      expect(Number(mainBal.balance)).toBeGreaterThan(0);
      expect(Number(subBal.balance)).toBeGreaterThan(0);
    }, E2E_TIMEOUT);

    test("--wallet sub resolves correct address", async () => {
      const { json } = await runCli("--wallet", "sub", "protocol", "my-status");
      expect(json.address).toBe(TEST_ACCOUNTS[1].address);
    }, E2E_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════
  //  Error handling
  // ═══════════════════════════════════════════════════════════

  describe("error handling", () => {
    test("upgrade-tier fails for Tier 0 with insufficient activity", async () => {
      const { exitCode, stderr } = await runCli("agent", "upgrade-tier");
      expect(exitCode).toBe(1);
      expect(stderr.length).toBeGreaterThan(0);
    }, E2E_TIMEOUT);

    test("error output is valid JSON on stderr", async () => {
      const { exitCode, stderr } = await runCli("agent", "upgrade-tier");
      expect(exitCode).toBe(1);
      const parsed = JSON.parse(stderr.trim());
      expect(parsed).toHaveProperty("message");
    }, E2E_TIMEOUT);

    test("--human error outputs readable format", async () => {
      const { exitCode, stderr } = await runCli("agent", "upgrade-tier", "--human");
      expect(exitCode).toBe(1);
      expect(stderr).toMatch(/^Error/);
    }, E2E_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════
  //  Listen (event listener lifecycle)
  // ═══════════════════════════════════════════════════════════

  describe("listen", () => {
    test("listen questions starts and can be killed", async () => {
      const CLI_PATH = join(import.meta.dir, "..", "..", "src", "main.ts");
      const proc = Bun.spawn(
        ["bun", "run", CLI_PATH, "listen", "questions"],
        {
          stdout: "pipe",
          stderr: "pipe",
          env: {
            ...process.env,
            HOME: getConfigDir(),
            CHISIKI_MASTER_PASSWORD: "test-password-e2e",
            CHISIKI_RPC_URL: "http://127.0.0.1:8545",
          },
        },
      );
      await new Promise((r) => setTimeout(r, 2000));
      proc.kill("SIGTERM");
      const exitCode = await proc.exited;
      expect(exitCode).toBeDefined();
    }, E2E_TIMEOUT);
  });
});
