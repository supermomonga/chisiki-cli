import { describe, test, expect } from "bun:test";
import { deriveIdempotentSalt, generateSaltSeed } from "../src/lib/salt.js";

describe("deriveIdempotentSalt", () => {
  test("is deterministic", () => {
    const a = deriveIdempotentSalt("seed1", 42, 0, 1, 2);
    const b = deriveIdempotentSalt("seed1", 42, 0, 1, 2);
    expect(a).toBe(b);
  });

  test("differs with different seed", () => {
    const a = deriveIdempotentSalt("seed1", 42, 0);
    const b = deriveIdempotentSalt("seed2", 42, 0);
    expect(a).not.toBe(b);
  });

  test("differs with different questionId", () => {
    const a = deriveIdempotentSalt("seed", 1, 0);
    const b = deriveIdempotentSalt("seed", 2, 0);
    expect(a).not.toBe(b);
  });

  test("differs with different bestIdx", () => {
    const a = deriveIdempotentSalt("seed", 42, 0);
    const b = deriveIdempotentSalt("seed", 42, 1);
    expect(a).not.toBe(b);
  });

  test("differs with different runners", () => {
    const a = deriveIdempotentSalt("seed", 42, 0, 1, 2);
    const b = deriveIdempotentSalt("seed", 42, 0, 3, 4);
    expect(a).not.toBe(b);
  });

  test("treats undefined runners as -1", () => {
    const a = deriveIdempotentSalt("seed", 42, 0);
    const b = deriveIdempotentSalt("seed", 42, 0, undefined, undefined);
    expect(a).toBe(b);
  });

  test("returns 64-char hex string (sha256)", () => {
    const salt = deriveIdempotentSalt("seed", 42, 0);
    expect(salt).toMatch(/^[0-9a-f]{64}$/);
  });

  test("commit and reveal produce the same salt for same params", () => {
    const seed = "my-secret-seed";
    const commitSalt = deriveIdempotentSalt(seed, 123, 1, undefined, undefined);
    const revealSalt = deriveIdempotentSalt(seed, 123, 1, undefined, undefined);
    expect(commitSalt).toBe(revealSalt);
  });

  test("runner presence changes the derived salt", () => {
    const seed = "seed";
    const noRunners = deriveIdempotentSalt(seed, 42, 0);
    const withRunner1 = deriveIdempotentSalt(seed, 42, 0, 3);
    const withBoth = deriveIdempotentSalt(seed, 42, 0, 3, 5);
    expect(noRunners).not.toBe(withRunner1);
    expect(withRunner1).not.toBe(withBoth);
    expect(noRunners).not.toBe(withBoth);
  });
});

describe("generateSaltSeed", () => {
  test("returns 64-char hex string", () => {
    const seed = generateSaltSeed();
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });

  test("produces unique values", () => {
    const seeds = new Set(Array.from({ length: 10 }, () => generateSaltSeed()));
    expect(seeds.size).toBe(10);
  });
});
