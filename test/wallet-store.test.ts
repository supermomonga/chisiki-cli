import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from "node:crypto";

const MAGIC = Buffer.from("CHSK");
const VERSION = 1;
const PBKDF2_ITERATIONS = 100_000;
const KEY_LEN = 32;
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
const PRIVATE_KEY_LEN = 32;
const ENCRYPTED_KEY_LEN = PRIVATE_KEY_LEN + AUTH_TAG_LEN;

describe("wallet-store binary format", () => {
  test("build and parse wallet file roundtrip", () => {
    const salt = randomBytes(32);
    const password = "test-password";
    const derivedKey = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LEN, "sha256");

    const testKey = "0x" + randomBytes(32).toString("hex");
    const keyBytes = Buffer.from(testKey.replace(/^0x/, ""), "hex");

    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);
    const encrypted = Buffer.concat([cipher.update(keyBytes), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const encryptedKey = Buffer.concat([encrypted, authTag]);

    // Build file manually
    const nameBuf = Buffer.from("main", "utf8");
    const countBuf = Buffer.alloc(2);
    countBuf.writeUInt16BE(1);

    const fileBuf = Buffer.concat([
      MAGIC,
      Buffer.from([VERSION]),
      salt,
      countBuf,
      Buffer.from([nameBuf.length]),
      nameBuf,
      iv,
      encryptedKey,
    ]);

    // Parse it back
    let offset = 0;
    const magic = fileBuf.subarray(offset, offset + 4);
    offset += 4;
    expect(magic.equals(MAGIC)).toBe(true);

    const version = fileBuf.readUInt8(offset);
    offset += 1;
    expect(version).toBe(VERSION);

    const parsedSalt = fileBuf.subarray(offset, offset + 32);
    offset += 32;
    expect(Buffer.from(parsedSalt).equals(salt)).toBe(true);

    const walletCount = fileBuf.readUInt16BE(offset);
    offset += 2;
    expect(walletCount).toBe(1);

    const nameLen = fileBuf.readUInt8(offset);
    offset += 1;
    const name = fileBuf.subarray(offset, offset + nameLen).toString("utf8");
    offset += nameLen;
    expect(name).toBe("main");

    const parsedIv = fileBuf.subarray(offset, offset + IV_LEN);
    offset += IV_LEN;
    const parsedEncKey = fileBuf.subarray(offset, offset + ENCRYPTED_KEY_LEN);
    offset += ENCRYPTED_KEY_LEN;

    // Decrypt
    const ciphertext = parsedEncKey.subarray(0, PRIVATE_KEY_LEN);
    const parsedAuthTag = parsedEncKey.subarray(PRIVATE_KEY_LEN);
    const decipher = createDecipheriv("aes-256-gcm", derivedKey, parsedIv);
    decipher.setAuthTag(parsedAuthTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const recoveredKey = "0x" + decrypted.toString("hex");
    expect(recoveredKey).toBe(testKey);
  });

  test("multiple wallets in a single file", () => {
    const salt = randomBytes(32);
    const password = "multi-wallet-test";
    const derivedKey = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LEN, "sha256");

    const wallets = [
      { name: "main", key: randomBytes(32) },
      { name: "sub", key: randomBytes(32) },
      { name: "backup", key: randomBytes(32) },
    ];

    const entries: Buffer[] = [];
    for (const w of wallets) {
      const iv = randomBytes(IV_LEN);
      const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);
      const encrypted = Buffer.concat([cipher.update(w.key), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const encKey = Buffer.concat([encrypted, authTag]);

      const nameBuf = Buffer.from(w.name, "utf8");
      entries.push(Buffer.concat([
        Buffer.from([nameBuf.length]),
        nameBuf,
        iv,
        encKey,
      ]));
    }

    const countBuf = Buffer.alloc(2);
    countBuf.writeUInt16BE(wallets.length);
    const fileBuf = Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, countBuf, ...entries]);

    // Parse and count entries
    let offset = 4 + 1 + 32; // magic + version + salt
    const walletCount = fileBuf.readUInt16BE(offset);
    offset += 2;
    expect(walletCount).toBe(3);

    const parsedNames: string[] = [];
    for (let i = 0; i < walletCount; i++) {
      const nameLen = fileBuf.readUInt8(offset);
      offset += 1;
      parsedNames.push(fileBuf.subarray(offset, offset + nameLen).toString("utf8"));
      offset += nameLen + IV_LEN + ENCRYPTED_KEY_LEN;
    }
    expect(parsedNames).toEqual(["main", "sub", "backup"]);
  });

  test("wrong password fails decryption", () => {
    const salt = randomBytes(32);
    const correctKey = pbkdf2Sync("correct", salt, PBKDF2_ITERATIONS, KEY_LEN, "sha256");
    const wrongKey = pbkdf2Sync("wrong", salt, PBKDF2_ITERATIONS, KEY_LEN, "sha256");

    const plainKey = randomBytes(32);
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv("aes-256-gcm", correctKey, iv);
    const encrypted = Buffer.concat([cipher.update(plainKey), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const encKey = Buffer.concat([encrypted, authTag]);

    const ciphertext = encKey.subarray(0, PRIVATE_KEY_LEN);
    const parsedAuthTag = encKey.subarray(PRIVATE_KEY_LEN);
    const decipher = createDecipheriv("aes-256-gcm", wrongKey, iv);
    decipher.setAuthTag(parsedAuthTag);

    expect(() => {
      Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    }).toThrow();
  });
});
