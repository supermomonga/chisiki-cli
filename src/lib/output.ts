import { Table } from "@cliffy/table";
import type { GlobalOptions } from "../types/index.js";

export function outputResult(data: unknown, options: GlobalOptions): void {
  if (options.quiet) return;
  if (options.human) {
    outputHuman(data);
  } else if (options.pretty) {
    process.stdout.write(JSON.stringify(data, bigintReplacer, 2) + "\n");
  } else {
    process.stdout.write(JSON.stringify(data, bigintReplacer) + "\n");
  }
}

export function outputError(error: unknown, options: GlobalOptions): void {
  if (options.quiet) return;
  const err = normalizeError(error);
  if (options.human) {
    if (err.error) {
      process.stderr.write(`Error [${err.error}]: ${err.message}\n`);
    } else {
      process.stderr.write(`Error: ${err.message}\n`);
    }
  } else {
    process.stderr.write(JSON.stringify(err, bigintReplacer) + "\n");
  }
}

function normalizeError(error: unknown): { error?: string; message: string; [key: string]: unknown } {
  if (error && typeof error === "object" && "code" in error) {
    const e = error as any;
    return { error: e.code, message: e.message, ...extractExtra(e) };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: String(error) };
}

function extractExtra(e: any): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const key of Object.keys(e)) {
    if (key !== "code" && key !== "message" && key !== "stack" && key !== "cause") {
      extra[key] = e[key];
    }
  }
  return extra;
}

function outputHuman(data: unknown): void {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      process.stdout.write("(結果なし)\n");
      return;
    }
    const first = data[0];
    if (typeof first === "object" && first !== null) {
      const keys = Object.keys(first);
      const header = keys.map((k) => k);
      const rows = data.map((item: any) => keys.map((k) => formatValue(item[k])));
      const table = new Table().header(header).body(rows).border();
      process.stdout.write(table.toString() + "\n");
    } else {
      for (const item of data) {
        process.stdout.write(String(item) + "\n");
      }
    }
  } else if (typeof data === "object" && data !== null) {
    const entries = Object.entries(data as Record<string, unknown>);
    const rows = entries.map(([k, v]) => [k, formatValue(v)]);
    const table = new Table().body(rows).border();
    process.stdout.write(table.toString() + "\n");
  } else {
    process.stdout.write(String(data) + "\n");
  }
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "object") return JSON.stringify(v, bigintReplacer);
  return String(v);
}

function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}
