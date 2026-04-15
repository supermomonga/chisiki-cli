import { Command } from "@cliffy/command";
import { createSDK } from "../lib/sdk.js";
import { outputResult, outputError } from "../lib/output.js";
import { spawn } from "node:child_process";

export const autoCommand = new Command()
  .description("Autonomous workflows")
  .action(function () { this.showHelp(); })
  .command("solve")
  .description("Auto solve: HoF → Q&A search → post question")
  .arguments("<problem-cid:string>")
  .option("--max-reward <amount:string>", "Max reward amount (CKT)")
  .option("--deadline <hours:number>", "Deadline (hours)")
  .option("--prefer-premium", "Prefer premium questions")
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
  .description("Auto earn: answer questions → register Tempo → claim rewards")
  .option("--answer-generator <command:string>", "Answer generator command (stdin: question JSON, stdout: answer CID)", { required: true })
  .option("--max-questions <n:number>", "Max questions to process")
  .option("--settle-expired", "Also settle expired questions")
  .option("--claim-tempo", "Also claim Tempo rewards")
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
              process.stderr.write(`Answer generator command exited with code ${code}: ${stderr}\n`);
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
        autoSettle: options.settleExpired ?? false,
        autoClaim: options.claimTempo ?? false,
      });
      outputResult(report, options);
    } catch (e) {
      outputError(e, options);
      process.exit(1);
    }
  });
