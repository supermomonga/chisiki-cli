import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { getConfigDir, ensureConfigDir, loadConfig, saveConfig } from "./config.js";

const MAGIC = Buffer.from("CHSK");
const VERSION = 1;
const PBKDF2_ITERATIONS = 100_000;
const KEY_LEN = 32;
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
const PRIVATE_KEY_LEN = 32;
const ENCRYPTED_KEY_LEN = PRIVATE_KEY_LEN + AUTH_TAG_LEN;

function getWalletPath(): string {
  return join(getConfigDir(), "wallets.enc");
}

function deriveKey(password: string, salt: Uint8Array): Buffer {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LEN, "sha256");
}

async function getMasterPassword(): Promise<string> {
  if (process.env.CHISIKI_MASTER_PASSWORD) {
    return process.env.CHISIKI_MASTER_PASSWORD;
  }
  const prompt = (await import("node:readline")).createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise<string>((resolve) => {
    process.stderr.write("Master password: ");
    prompt.question("", (answer) => {
      prompt.close();
      resolve(answer);
    });
  });
}

interface WalletFileData {
  salt: Uint8Array;
  entries: { name: string; iv: Uint8Array; encryptedKey: Uint8Array }[];
}

function parseWalletFile(buf: Buffer): WalletFileData {
  let offset = 0;
  const magic = buf.subarray(offset, offset + 4);
  offset += 4;
  if (!magic.equals(MAGIC)) throw new Error("無効なウォレットファイルです");

  const version = buf.readUInt8(offset);
  offset += 1;
  if (version !== VERSION) throw new Error(`未対応のウォレットファイルバージョン: ${version}`);

  const salt = buf.subarray(offset, offset + 32);
  offset += 32;

  const walletCount = buf.readUInt16BE(offset);
  offset += 2;

  const entries: WalletFileData["entries"] = [];
  for (let i = 0; i < walletCount; i++) {
    const nameLen = buf.readUInt8(offset);
    offset += 1;
    const name = buf.subarray(offset, offset + nameLen).toString("utf8");
    offset += nameLen;
    const iv = buf.subarray(offset, offset + IV_LEN);
    offset += IV_LEN;
    const encryptedKey = buf.subarray(offset, offset + ENCRYPTED_KEY_LEN);
    offset += ENCRYPTED_KEY_LEN;
    entries.push({ name, iv, encryptedKey });
  }

  return { salt, entries };
}

function buildWalletFile(data: WalletFileData): Buffer {
  const parts: Buffer[] = [];
  parts.push(MAGIC);
  parts.push(Buffer.from([VERSION]));
  parts.push(Buffer.from(data.salt));

  const countBuf = Buffer.alloc(2);
  countBuf.writeUInt16BE(data.entries.length);
  parts.push(countBuf);

  for (const entry of data.entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    parts.push(Buffer.from([nameBuf.length]));
    parts.push(nameBuf);
    parts.push(Buffer.from(entry.iv));
    parts.push(Buffer.from(entry.encryptedKey));
  }

  return Buffer.concat(parts);
}

function encryptPrivateKey(privateKey: string, derivedKey: Buffer): { iv: Uint8Array; encryptedKey: Uint8Array } {
  const iv = randomBytes(IV_LEN);
  const keyBytes = Buffer.from(privateKey.replace(/^0x/, ""), "hex");
  if (keyBytes.length !== PRIVATE_KEY_LEN) {
    throw new Error("秘密鍵は32バイト (64文字の16進数) である必要があります");
  }
  const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(keyBytes), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv,
    encryptedKey: Buffer.concat([encrypted, authTag]),
  };
}

function decryptPrivateKey(encryptedKey: Uint8Array, iv: Uint8Array, derivedKey: Buffer): string {
  const ciphertext = encryptedKey.subarray(0, PRIVATE_KEY_LEN);
  const authTag = encryptedKey.subarray(PRIVATE_KEY_LEN);
  const decipher = createDecipheriv("aes-256-gcm", derivedKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return "0x" + decrypted.toString("hex");
}

async function loadWalletFile(): Promise<WalletFileData | null> {
  const path = getWalletPath();
  if (!existsSync(path)) return null;
  const buf = await readFile(path);
  return parseWalletFile(buf as unknown as Buffer);
}

async function saveWalletFile(data: WalletFileData): Promise<void> {
  await ensureConfigDir();
  const buf = buildWalletFile(data);
  await writeFile(getWalletPath(), buf);
}

export async function initWalletFile(force: boolean): Promise<void> {
  const path = getWalletPath();
  if (existsSync(path) && !force) {
    throw new Error(`ウォレットファイルが既に存在します: ${path}\n上書きするには --force を指定してください`);
  }
  const salt = randomBytes(32);
  await saveWalletFile({ salt, entries: [] });
}

export async function addWallet(name: string, privateKey: string): Promise<string> {
  const password = await getMasterPassword();
  let data = await loadWalletFile();
  if (!data) {
    const salt = randomBytes(32);
    data = { salt, entries: [] };
  }
  if (data.entries.some((e) => e.name === name)) {
    throw new Error(`ウォレット '${name}' は既に登録されています`);
  }
  const derivedKey = deriveKey(password, data.salt);
  const { iv, encryptedKey } = encryptPrivateKey(privateKey, derivedKey);
  data.entries.push({ name, iv, encryptedKey });
  await saveWalletFile(data);

  const { ethers } = await import("ethers");
  const wallet = new ethers.Wallet(privateKey);
  const config = await loadConfig();
  if (!config.wallet) config.wallet = {};
  config.wallet[name] = { address: wallet.address };
  await saveConfig(config);

  return wallet.address;
}

export async function removeWallet(name: string): Promise<void> {
  const data = await loadWalletFile();
  if (!data) throw new Error("ウォレットファイルが見つかりません");
  const idx = data.entries.findIndex((e) => e.name === name);
  if (idx === -1) throw new Error(`ウォレット '${name}' が見つかりません`);
  data.entries.splice(idx, 1);
  await saveWalletFile(data);

  const config = await loadConfig();
  delete config.wallet[name];
  await saveConfig(config);
}

export async function listWallets(): Promise<{ name: string; address: string }[]> {
  const config = await loadConfig();
  return Object.entries(config.wallet ?? {}).map(([name, w]) => ({
    name,
    address: w.address,
  }));
}

export async function exportPrivateKey(name: string): Promise<string> {
  const data = await loadWalletFile();
  if (!data) throw new Error("ウォレットファイルが見つかりません");
  const entry = data.entries.find((e) => e.name === name);
  if (!entry) throw new Error(`ウォレット '${name}' が見つかりません`);
  const password = await getMasterPassword();
  const derivedKey = deriveKey(password, data.salt);
  return decryptPrivateKey(entry.encryptedKey, entry.iv, derivedKey);
}

export async function getPrivateKey(name: string): Promise<string> {
  return exportPrivateKey(name);
}

export function getWalletFilePath(): string {
  return getWalletPath();
}
