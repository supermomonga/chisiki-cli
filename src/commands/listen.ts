import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputError } from "../lib/output.js";

function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}

export const listenCommand = new Command()
  .description("イベントリスナー (NDJSON 出力)")
  .command("purchases")
  .description("購入イベントをリアルタイム監視する")
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
  .description("回答イベントをリアルタイム監視する")
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
  .description("新規質問イベントをリアルタイム監視する")
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
