import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";
import { spawn } from "node:child_process";

export const autoCommand = new Command()
  .description("自律ワークフロー")
  .action(function () { this.showHelp(); })
  .command("solve")
  .description("自動問題解決: HoF → Q&A 検索 → 質問投稿の順で自動判断")
  .arguments("<problem-cid:string>")
  .option("--max-reward <amount:string>", "最大報酬 CKT 額")
  .option("--deadline <hours:number>", "期限 (時間)")
  .option("--prefer-premium", "プレミアム質問を優先する")
  .action(async (options: any, problemCid: string) => {
    try {
      const sdk = await createSDK(options);
      const result = await sdk.autoSolve(problemCid, {
        rewardCKT: options.maxReward,
        deadlineHours: options.deadline,
        premiumMode: options.preferPremium ? "auto" : "never",
      });
      outputResult(result, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  })
  .reset()
  .command("earn")
  .description("自動収益: 質問検索 → 回答 → 期限切れ決済 → Tempo 請求")
  .option("--answer-generator <command:string>", "回答生成コマンド (stdin: 質問JSON, stdout: 回答CID)", { required: true })
  .option("--max-questions <n:number>", "最大質問数")
  .option("--settle-expired", "期限切れ質問を自動決済する")
  .option("--claim-tempo", "Tempo リワードを自動請求する")
  .action(async (options: any) => {
    try {
      const sdk = await createSDK(options);
      const generatorCmd = options.answerGenerator;

      const answerGenerator = async (question: any): Promise<string | null> => {
        return new Promise((resolve, reject) => {
          const proc = spawn("sh", ["-c", generatorCmd], {
            stdio: ["pipe", "pipe", "pipe"],
          });
          let stdout = "";
          let stderr = "";
          proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
          proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
          proc.on("close", (code: number | null) => {
            if (code !== 0) {
              process.stderr.write(`回答生成コマンドがエラーコード ${code} で終了: ${stderr}\n`);
              resolve(null);
            } else {
              resolve(stdout.trim() || null);
            }
          });
          proc.on("error", (err: Error) => reject(err));
          proc.stdin.write(JSON.stringify(question));
          proc.stdin.end();
        });
      };

      const report = await sdk.autoEarn(answerGenerator, {
        maxAnswersPerRun: options.maxQuestions,
        autoSettle: options.settleExpired ?? true,
        autoClaim: options.claimTempo ?? true,
      });
      outputResult(report, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
