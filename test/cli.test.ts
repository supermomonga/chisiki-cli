import { describe, test, expect } from "bun:test";
import { join } from "node:path";

const CLI = join(import.meta.dir, "..", "src", "main.ts");

async function run(...args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", CLI, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1" },
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

describe("CLI integration", () => {
  test("--version outputs version", async () => {
    const { stdout, exitCode } = await run("--version");
    expect(stdout).toContain("0.1.0");
    expect(exitCode).toBe(0);
  });

  test("--help shows all commands", async () => {
    const { stdout, exitCode } = await run("--help");
    const commands = [
      "agent", "token", "qa", "knowledge", "tempo", "hof",
      "reputation", "insurance", "report", "protocol",
      "auto", "listen", "wallet", "config", "init",
    ];
    for (const cmd of commands) {
      expect(stdout).toContain(cmd);
    }
    expect(exitCode).toBe(0);
  });

  test("agent --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("agent", "--help");
    expect(stdout).toContain("register");
    expect(stdout).toContain("status");
    expect(stdout).toContain("upgrade-tier");
    expect(stdout).toContain("invite-code");
    expect(stdout).toContain("invite-quota");
    expect(stdout).toContain("is-open-registration");
    expect(exitCode).toBe(0);
  });

  test("qa --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("qa", "--help");
    expect(stdout).toContain("post-question");
    expect(stdout).toContain("post-premium-question");
    expect(stdout).toContain("post-answer");
    expect(stdout).toContain("upvote");
    expect(stdout).toContain("commit-best");
    expect(stdout).toContain("reveal-best");
    expect(stdout).toContain("withdraw");
    expect(stdout).toContain("auto-settle");
    expect(stdout).toContain("search");
    expect(stdout).toContain("search-direct");
    expect(stdout).toContain("batch-settle");
    expect(exitCode).toBe(0);
  });

  test("knowledge --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("knowledge", "--help");
    expect(stdout).toContain("list");
    expect(stdout).toContain("purchase");
    expect(stdout).toContain("deliver");
    expect(stdout).toContain("claim-undelivered");
    expect(stdout).toContain("get");
    expect(stdout).toContain("get-purchase");
    expect(stdout).toContain("search");
    expect(stdout).toContain("review");
    expect(stdout).toContain("auto-review");
    expect(exitCode).toBe(0);
  });

  test("tempo --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("tempo", "--help");
    expect(stdout).toContain("current");
    expect(stdout).toContain("register-score");
    expect(stdout).toContain("claim-reward");
    expect(stdout).toContain("trigger-distribution");
    expect(stdout).toContain("streak");
    expect(stdout).toContain("contribution-score");
    expect(exitCode).toBe(0);
  });

  test("hof --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("hof", "--help");
    expect(stdout).toContain("nominate");
    expect(stdout).toContain("vote");
    expect(stdout).toContain("search");
    expect(exitCode).toBe(0);
  });

  test("insurance --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("insurance", "--help");
    expect(stdout).toContain("activate");
    expect(stdout).toContain("deactivate");
    expect(stdout).toContain("renew");
    expect(stdout).toContain("cost");
    expect(stdout).toContain("status");
    expect(exitCode).toBe(0);
  });

  test("wallet --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("wallet", "--help");
    expect(stdout).toContain("add");
    expect(stdout).toContain("list");
    expect(stdout).toContain("remove");
    expect(stdout).toContain("set-default");
    expect(stdout).toContain("export");
    expect(exitCode).toBe(0);
  });

  test("config --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("config", "--help");
    expect(stdout).toContain("show");
    expect(stdout).toContain("set");
    expect(stdout).toContain("path");
    expect(exitCode).toBe(0);
  });

  test("config path outputs JSON with path", async () => {
    const { stdout, exitCode } = await run("config", "path");
    const parsed = JSON.parse(stdout.trim());
    expect(parsed.path).toContain("config.toml");
    expect(exitCode).toBe(0);
  });

  test("config path --pretty outputs formatted JSON", async () => {
    const { stdout, exitCode } = await run("config", "path", "--pretty");
    expect(stdout).toContain("  ");
    const parsed = JSON.parse(stdout.trim());
    expect(parsed.path).toContain("config.toml");
    expect(exitCode).toBe(0);
  });

  test("global options are shown in subcommands", async () => {
    const { stdout } = await run("agent", "--help");
    expect(stdout).toContain("--wallet");
    expect(stdout).toContain("--rpc-url");
    expect(stdout).toContain("--chain-id");
    expect(stdout).toContain("--human");
    expect(stdout).toContain("--pretty");
    expect(stdout).toContain("--quiet");
  });

  test("protocol --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("protocol", "--help");
    expect(stdout).toContain("rules");
    expect(stdout).toContain("my-status");
    expect(exitCode).toBe(0);
  });

  test("report --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("report", "--help");
    expect(stdout).toContain("submit");
    expect(stdout).toContain("dispute");
    expect(stdout).toContain("auto-validate");
    expect(exitCode).toBe(0);
  });

  test("reputation --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("reputation", "--help");
    expect(stdout).toContain("get");
    expect(stdout).toContain("claim-badges");
    expect(exitCode).toBe(0);
  });

  test("auto --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("auto", "--help");
    expect(stdout).toContain("solve");
    expect(stdout).toContain("earn");
    expect(exitCode).toBe(0);
  });

  test("auto earn --help shows options", async () => {
    const { stdout, exitCode } = await run("auto", "earn", "--help");
    expect(stdout).toContain("--answer-generator");
    expect(stdout).toContain("--max-questions");
    expect(stdout).toContain("--settle-expired");
    expect(stdout).toContain("--claim-tempo");
    expect(exitCode).toBe(0);
  });

  test("auto solve --help shows options", async () => {
    const { stdout, exitCode } = await run("auto", "solve", "--help");
    expect(stdout).toContain("--max-reward");
    expect(stdout).toContain("--deadline");
    expect(stdout).toContain("--prefer-premium");
    expect(stdout).toContain("problem-cid");
    expect(exitCode).toBe(0);
  });

  test("listen --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("listen", "--help");
    expect(stdout).toContain("purchases");
    expect(stdout).toContain("answers");
    expect(stdout).toContain("questions");
    expect(exitCode).toBe(0);
  });

  test("qa search-direct --help shows options", async () => {
    const { stdout, exitCode } = await run("qa", "search-direct", "--help");
    expect(stdout).toContain("--tags");
    expect(stdout).toContain("--unsettled");
    expect(stdout).toContain("--max-results");
    expect(exitCode).toBe(0);
  });

  test("qa batch-settle --help shows arguments", async () => {
    const { stdout, exitCode } = await run("qa", "batch-settle", "--help");
    expect(stdout).toContain("question-ids");
    expect(exitCode).toBe(0);
  });

  test("reputation claim-badges --help shows options", async () => {
    const { stdout, exitCode } = await run("reputation", "claim-badges", "--help");
    expect(stdout).toContain("--address");
    expect(exitCode).toBe(0);
  });

  test("token --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("token", "--help");
    expect(stdout).toContain("balance");
    expect(stdout).toContain("approve");
    expect(stdout).toContain("transactions");
    expect(exitCode).toBe(0);
  });
});
