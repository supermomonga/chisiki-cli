import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { outputResult, outputError } from "../src/lib/output.js";

describe("output", () => {
  let stdoutData: string;
  let stderrData: string;
  let stdoutSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    stdoutData = "";
    stderrData = "";
    stdoutSpy = spyOn(process.stdout, "write").mockImplementation((chunk: any) => {
      stdoutData += String(chunk);
      return true;
    });
    stderrSpy = spyOn(process.stderr, "write").mockImplementation((chunk: any) => {
      stderrData += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  describe("outputResult", () => {
    test("outputs JSON by default", () => {
      outputResult({ name: "agent1", tier: 2 }, {});
      expect(stdoutData).toBe('{"name":"agent1","tier":2}\n');
    });

    test("outputs pretty JSON with --pretty", () => {
      outputResult({ name: "agent1" }, { pretty: true });
      expect(stdoutData).toContain('"name": "agent1"');
      expect(stdoutData).toContain("\n");
    });

    test("outputs nothing with --quiet", () => {
      outputResult({ name: "agent1" }, { quiet: true });
      expect(stdoutData).toBe("");
    });

    test("handles bigint values in JSON", () => {
      outputResult({ value: 100n }, {});
      expect(stdoutData).toBe('{"value":"100"}\n');
    });

    test("outputs human-readable table with --human for object", () => {
      outputResult({ name: "agent1", tier: 2 }, { human: true });
      expect(stdoutData).toContain("name");
      expect(stdoutData).toContain("agent1");
      expect(stdoutData).toContain("tier");
      expect(stdoutData).toContain("2");
    });

    test("outputs human-readable table with --human for array", () => {
      outputResult([
        { name: "a1", tier: 1 },
        { name: "a2", tier: 2 },
      ], { human: true });
      expect(stdoutData).toContain("name");
      expect(stdoutData).toContain("a1");
      expect(stdoutData).toContain("a2");
    });

    test("outputs empty message for empty array with --human", () => {
      outputResult([], { human: true });
      expect(stdoutData).toContain("(no results)");
    });
  });

  describe("outputError", () => {
    test("outputs error JSON to stderr", () => {
      outputError({ code: "E_BAL", message: "残高不足" }, {});
      const parsed = JSON.parse(stderrData.trim());
      expect(parsed.error).toBe("E_BAL");
      expect(parsed.message).toBe("残高不足");
    });

    test("outputs human error to stderr", () => {
      outputError({ code: "E_BAL", message: "残高不足" }, { human: true });
      expect(stderrData).toContain("Error [E_BAL]: 残高不足");
    });

    test("handles Error instances", () => {
      outputError(new Error("something failed"), {});
      const parsed = JSON.parse(stderrData.trim());
      expect(parsed.message).toBe("something failed");
    });

    test("handles string errors", () => {
      outputError("raw error string", {});
      const parsed = JSON.parse(stderrData.trim());
      expect(parsed.message).toBe("raw error string");
    });

    test("outputs nothing with --quiet", () => {
      outputError(new Error("fail"), { quiet: true });
      expect(stderrData).toBe("");
    });
  });
});
