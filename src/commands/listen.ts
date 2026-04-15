import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputError } from "../lib/output.js";

function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}

export const listenCommand = new Command()
  .description("Event listener (NDJSON output)")
  .action(function () { this.showHelp(); })
  .command("purchases")
  .description("Monitor purchase events in real-time")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const unsub = sdk.onPurchase((purchaseId, buyer, knowledgeId) => {
        process.stdout.write(JSON.stringify({ event: "purchase", purchaseId, buyer, knowledgeId }, bigintReplacer) + "\n");
      });
      process.on("SIGINT", () => {
        unsub();
        process.exit(0);
      });
      // Keep alive
      await new Promise(() => {});
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("answers")
  .description("Monitor answer events in real-time")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const unsub = sdk.onAnswer((questionId, answerIndex, answerer) => {
        process.stdout.write(JSON.stringify({ event: "answer", questionId, answerIndex, answerer }, bigintReplacer) + "\n");
      });
      process.on("SIGINT", () => {
        unsub();
        process.exit(0);
      });
      await new Promise(() => {});
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("questions")
  .description("Monitor question events in real-time")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const unsub = sdk.onNewQuestion((questionId, asker, reward, tags) => {
        process.stdout.write(JSON.stringify({ event: "question", questionId, asker, reward: reward.toString(), tags }, bigintReplacer) + "\n");
      });
      process.on("SIGINT", () => {
        unsub();
        process.exit(0);
      });
      await new Promise(() => {});
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
