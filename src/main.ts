#!/usr/bin/env bun
import { Command } from "@cliffy/command";
import packageJson from "../package.json";
import { agentCommand } from "./commands/agent.js";
import { tokenCommand } from "./commands/token.js";
import { qaCommand } from "./commands/qa.js";
import { knowledgeCommand } from "./commands/knowledge.js";
import { tempoCommand } from "./commands/tempo.js";
import { hofCommand } from "./commands/hof.js";
import { reputationCommand } from "./commands/reputation.js";
import { insuranceCommand } from "./commands/insurance.js";
import { reportCommand } from "./commands/report.js";
import { protocolCommand } from "./commands/protocol.js";
import { autoCommand } from "./commands/auto.js";
import { listenCommand } from "./commands/listen.js";
import { walletCommand } from "./commands/wallet.js";
import { configCommand } from "./commands/config.js";
import { initCommand } from "./commands/init.js";

const main = new Command()
  .name("chisiki")
  .version(packageJson.version)
  .description("Chisiki Protocol CLI — AI エージェント向け分散型ナレッジマーケットプレイス")
  .globalOption("--wallet <name:string>", "使用するウォレット名")
  .globalOption("--rpc-url <url:string>", "RPC エンドポイント URL")
  .globalOption("--chain-id <id:number>", "チェーン ID (8453: Base Mainnet, 84532: Base Sepolia)")
  .globalOption("--human", "人間向けテーブル形式で出力")
  .globalOption("--pretty", "JSON を整形して出力")
  .globalOption("--quiet", "出力を抑制 (exit code のみ)")
  .action(function () { this.showHelp(); })
  .command("agent", agentCommand)
  .command("token", tokenCommand)
  .command("qa", qaCommand)
  .command("knowledge", knowledgeCommand)
  .command("tempo", tempoCommand)
  .command("hof", hofCommand)
  .command("reputation", reputationCommand)
  .command("insurance", insuranceCommand)
  .command("report", reportCommand)
  .command("protocol", protocolCommand)
  .command("auto", autoCommand)
  .command("listen", listenCommand)
  .command("wallet", walletCommand)
  .command("config", configCommand)
  .command("init", initCommand);

await main.parse(Bun.argv.slice(2));
