import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { outputResult, outputError } from "../src/lib/output.js";

function withTTY(stream: { isTTY?: boolean }, isTTY: boolean, fn: () => void): void {
  const descriptor = Object.getOwnPropertyDescriptor(stream, "isTTY");
  Object.defineProperty(stream, "isTTY", { value: isTTY, configurable: true });
  try {
    fn();
  } finally {
    if (descriptor) {
      Object.defineProperty(stream, "isTTY", descriptor);
    } else {
      delete (stream as any).isTTY;
    }
  }
}

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
    test("outputs JSON by default when stdout is not a TTY", () => {
      withTTY(process.stdout, false, () => {
        outputResult({ name: "agent1", tier: 2 }, {});
      });
      expect(stdoutData).toBe('{"name":"agent1","tier":2}\n');
    });

    test("outputs JSON with --format=json even when stdout is a TTY", () => {
      withTTY(process.stdout, true, () => {
        outputResult({ name: "agent1", tier: 2 }, { format: "json" });
      });
      expect(stdoutData).toBe('{"name":"agent1","tier":2}\n');
    });

    test("outputs pretty table by default when stdout is a TTY", () => {
      withTTY(process.stdout, true, () => {
        outputResult({ name: "agent1", tier: 2 }, {});
      });
      expect(stdoutData).toContain("name");
      expect(stdoutData).toContain("agent1");
      expect(stdoutData).toMatch(/[┌┐└┘│─]/);
    });

    test("outputs nothing with --quiet", () => {
      outputResult({ name: "agent1" }, { quiet: true });
      expect(stdoutData).toBe("");
    });

    test("handles bigint values in JSON", () => {
      outputResult({ value: 100n }, { format: "json" });
      expect(stdoutData).toBe('{"value":"100"}\n');
    });

    test("outputs pretty table with --format=pretty for object", () => {
      outputResult({ name: "agent1", tier: 2 }, { format: "pretty" });
      expect(stdoutData).toContain("name");
      expect(stdoutData).toContain("agent1");
      expect(stdoutData).toContain("tier");
      expect(stdoutData).toContain("2");
    });

    test("outputs pretty table with --format=pretty for array", () => {
      outputResult([
        { name: "a1", tier: 1 },
        { name: "a2", tier: 2 },
      ], { format: "pretty" });
      expect(stdoutData).toContain("name");
      expect(stdoutData).toContain("a1");
      expect(stdoutData).toContain("a2");
    });

    test("outputs empty message for empty array with --format=pretty", () => {
      outputResult([], { format: "pretty" });
      expect(stdoutData).toContain("(no results)");
    });
  });

  describe("outputError", () => {
    test("outputs error JSON to stderr", () => {
      outputError({ code: "E_BAL", message: "残高不足" }, { format: "json" });
      const parsed = JSON.parse(stderrData.trim());
      expect(parsed.error).toBe("E_BAL");
      expect(parsed.message).toBe("残高不足");
    });

    test("outputs pretty error to stderr", () => {
      outputError({ code: "E_BAL", message: "残高不足" }, { format: "pretty" });
      expect(stderrData).toContain("Error [E_BAL]: 残高不足");
    });

    test("outputs pretty error by default when stderr is a TTY", () => {
      withTTY(process.stderr, true, () => {
        outputError({ code: "E_BAL", message: "残高不足" }, {});
      });
      expect(stderrData).toContain("Error [E_BAL]: 残高不足");
    });

    test("handles Error instances", () => {
      outputError(new Error("something failed"), { format: "json" });
      const parsed = JSON.parse(stderrData.trim());
      expect(parsed.message).toBe("something failed");
    });

    test("handles string errors", () => {
      outputError("raw error string", { format: "json" });
      const parsed = JSON.parse(stderrData.trim());
      expect(parsed.message).toBe("raw error string");
    });

    test("outputs nothing with --quiet", () => {
      outputError(new Error("fail"), { quiet: true });
      expect(stderrData).toBe("");
    });
  });
});
