import { createHash, randomBytes } from "node:crypto";
import { loadConfig } from "./config.js";

/**
 * Derive a deterministic salt string from the configured seed and commit parameters.
 * The same inputs always produce the same salt, enabling reveal without storing state.
 */
export function deriveIdempotentSalt(
  seed: string,
  questionId: number,
  bestIdx: number,
  runner1?: number,
  runner2?: number,
): string {
  const payload = [seed, questionId, bestIdx, runner1 ?? -1, runner2 ?? -1].join(":");
  return createHash("sha256").update(payload).digest("hex");
}

export function generateSaltSeed(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Resolve the salt to use for commit-best / reveal-best.
 * Priority: explicit --salt > idempotent derivation (if enabled) > undefined (SDK generates random)
 */
export async function resolveSalt(
  explicitSalt: string | undefined,
  questionId: number,
  bestIdx: number,
  runner1?: number,
  runner2?: number,
): Promise<string | undefined> {
  if (explicitSalt) return explicitSalt;
  const config = await loadConfig();
  if (!config.default.salt_idempotency || !config.default.salt_seed) return undefined;
  return deriveIdempotentSalt(config.default.salt_seed, questionId, bestIdx, runner1, runner2);
}
