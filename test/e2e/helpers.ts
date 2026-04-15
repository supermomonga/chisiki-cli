import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ethers } from "ethers";
import { ADDRESSES, CHAIN_IDS } from "@chisiki/sdk";
import CKT_ABI from "@chisiki/sdk/dist/abi/CKT.json";

const ANVIL_BIN = process.env.ANVIL_BIN ?? join(process.env.HOME!, ".foundry", "bin", "anvil");
const CLI = join(import.meta.dir, "..", "..", "src", "main.ts");
let RPC_URL = "http://127.0.0.1:8545";

// Anvil default test accounts
export const TEST_ACCOUNTS = [
  { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", pk: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" },
  { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", pk: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" },
] as const;

let anvilProcess: ChildProcess | null = null;
let configDir: string;
let provider: ethers.JsonRpcProvider;

export function getProvider(): ethers.JsonRpcProvider {
  return provider;
}

export function getConfigDir(): string {
  return configDir;
}

// Pin fork block to ensure deterministic on-chain state for E2E tests.
// Without this, tests break when Base mainnet contracts are upgraded or parameters change.
// Updated 2026-04-15: block 44_700_000 had incompatible QAEscrow state causing E_TX_REVERTED.
const FORK_BLOCK_NUMBER = 44_740_000;

export async function startAnvil(forkUrl: string = process.env.CHISIKI_RPC_URL ?? "https://mainnet.base.org", port: number = 8545): Promise<void> {
  RPC_URL = `http://127.0.0.1:${port}`;
  configDir = await mkdtemp(join(tmpdir(), "chisiki-e2e-"));

  anvilProcess = spawn(ANVIL_BIN, [
    "--fork-url", forkUrl,
    "--fork-block-number", String(FORK_BLOCK_NUMBER),
    "--port", String(port),
  ], { stdio: ["ignore", "pipe", "pipe"] });

  // Wait for anvil to be ready by polling RPC
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("anvil startup timeout")), 60000);
    let output = "";

    anvilProcess!.stdout!.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes("Listening on")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    anvilProcess!.stderr!.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes("Listening on")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    anvilProcess!.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    anvilProcess!.on("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`anvil exited with code ${code}: ${output}`));
      }
    });
  });

  provider = new ethers.JsonRpcProvider(RPC_URL);
}

export async function stopAnvil(): Promise<void> {
  if (anvilProcess) {
    anvilProcess.kill("SIGTERM");
    anvilProcess = null;
  }
  if (configDir) {
    await rm(configDir, { recursive: true, force: true });
  }
}

export async function snapshot(): Promise<string> {
  return provider.send("evm_snapshot", []);
}

export async function revert(id: string): Promise<void> {
  await provider.send("evm_revert", [id]);
}

export async function increaseTime(seconds: number): Promise<void> {
  await provider.send("evm_increaseTime", [seconds]);
  await provider.send("evm_mine", []);
}

/**
 * Fund a test account with CKT by impersonating a MINTER_ROLE holder.
 *
 * Steps:
 * 1. Read DEFAULT_ADMIN_ROLE from CKT contract
 * 2. Find the admin address (the deployer)
 * 3. Impersonate admin, grant MINTER_ROLE to test address
 * 4. Impersonate test address (now has MINTER_ROLE), mint CKT
 *
 * Falls back to storage slot probing if role-based approach fails.
 */
export async function fundCKT(address: string, amountCKT: string): Promise<void> {
  const addresses = ADDRESSES[CHAIN_IDS.BASE_MAINNET];
  const cktAddr = addresses.ckt;
  const amount = ethers.parseEther(amountCKT);

  // Try MINTER_ROLE approach
  const ckt = new ethers.Contract(cktAddr, CKT_ABI, provider);

  const MINTER_ROLE: string = await ckt.MINTER_ROLE();
  const DEFAULT_ADMIN_ROLE: string = await ckt.DEFAULT_ADMIN_ROLE();

  // Find who has DEFAULT_ADMIN_ROLE by checking RoleGranted events
  // Or just try the AgentRegistry as a known MINTER_ROLE holder
  const registryAddr = addresses.agentRegistry;
  const hasMinterRole = await ckt.hasRole(MINTER_ROLE, registryAddr);

  if (hasMinterRole) {
    // Impersonate AgentRegistry to mint
    await provider.send("anvil_impersonateAccount", [registryAddr]);
    await provider.send("anvil_setBalance", [registryAddr, ethers.toBeHex(ethers.parseEther("10"))]);
    const signer = await provider.getSigner(registryAddr);
    const cktAsMinter = new ethers.Contract(cktAddr, CKT_ABI, signer);
    await cktAsMinter.mint(address, amount);
    await provider.send("anvil_stopImpersonatingAccount", [registryAddr]);
    return;
  }

  // Fallback: find admin and grant role
  await fundCKTViaAdmin(cktAddr, address, amount, MINTER_ROLE, DEFAULT_ADMIN_ROLE);
}

async function fundCKTViaAdmin(
  cktAddr: string, target: string, amount: bigint,
  minterRole: string, adminRole: string,
): Promise<void> {
  // Search for admin via RoleGranted event
  const filter = {
    address: cktAddr,
    topics: [
      ethers.id("RoleGranted(bytes32,address,address)"),
      adminRole,
    ],
    fromBlock: 0,
    toBlock: "latest",
  };

  let adminAddress: string | null = null;
  try {
    const logs = await provider.getLogs(filter);
    if (logs.length > 0) {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["address"], logs[0].topics[2]);
      adminAddress = decoded[0];
    }
  } catch {
    // Event scan might fail; try common deployer pattern
  }

  if (!adminAddress) {
    // Fallback: use storage probing for ERC20 balance
    await fundCKTViaStorage(cktAddr, target, amount);
    return;
  }

  await provider.send("anvil_impersonateAccount", [adminAddress]);
  await provider.send("anvil_setBalance", [adminAddress, ethers.toBeHex(ethers.parseEther("10"))]);
  const adminSigner = await provider.getSigner(adminAddress);
  const cktAsAdmin = new ethers.Contract(cktAddr, CKT_ABI, adminSigner);
  await cktAsAdmin.grantRole(minterRole, target);
  await provider.send("anvil_stopImpersonatingAccount", [adminAddress]);

  await provider.send("anvil_impersonateAccount", [target]);
  const targetSigner = await provider.getSigner(target);
  const cktAsMinter = new ethers.Contract(cktAddr, CKT_ABI, targetSigner);
  await cktAsMinter.mint(target, amount);
  await provider.send("anvil_stopImpersonatingAccount", [target]);
}

/**
 * Last resort: probe ERC20 storage slots to directly set balance.
 */
async function fundCKTViaStorage(cktAddr: string, target: string, amount: bigint): Promise<void> {
  const ckt = new ethers.Contract(cktAddr, ["function balanceOf(address) view returns (uint256)"], provider);

  // Try common ERC20 balance mapping slots (including OZ v5 namespaced storage)
  const candidateSlots = [
    0n, 1n, 2n, 3n, 51n,
    // OZ v5 ERC20Upgradeable namespace: keccak256("openzeppelin.storage.ERC20") - 1
    BigInt("0x52c63247e1f47db19d5ce0460030c497f067ca4cebf71ba98eeadabe20bace00"),
  ];

  for (const slot of candidateSlots) {
    const storageKey = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [target, slot])
    );
    const prevBalance: bigint = await ckt.balanceOf(target);
    const testValue = ethers.parseEther("777777");
    await provider.send("anvil_setStorageAt", [
      cktAddr, storageKey,
      ethers.zeroPadValue(ethers.toBeHex(testValue), 32),
    ]);
    const newBalance: bigint = await ckt.balanceOf(target);
    if (newBalance === testValue) {
      // Found the slot! Set the actual amount
      await provider.send("anvil_setStorageAt", [
        cktAddr, storageKey,
        ethers.zeroPadValue(ethers.toBeHex(amount), 32),
      ]);
      return;
    }
    // Reset if we changed something unrelated
    if (newBalance !== prevBalance) {
      await provider.send("anvil_setStorageAt", [
        cktAddr, storageKey,
        ethers.zeroPadValue(ethers.toBeHex(prevBalance), 32),
      ]);
    }
  }
  throw new Error("Could not find CKT balance storage slot");
}

/**
 * Pre-approve CKT for all protocol contracts to avoid nonce race
 * between approve + action transactions in the SDK.
 */
export async function preApproveCKT(privateKey: string): Promise<void> {
  const addresses = ADDRESSES[CHAIN_IDS.BASE_MAINNET];
  const wallet = new ethers.Wallet(privateKey, provider);
  const managed = new ethers.NonceManager(wallet);
  const ckt = new ethers.Contract(addresses.ckt, CKT_ABI, managed);
  const max = ethers.MaxUint256;
  const spenders = [addresses.qaEscrow, addresses.knowledgeStore, addresses.agentRegistry, addresses.hallOfFame, addresses.tempoReward, addresses.report];
  for (const spender of spenders) {
    await (await ckt.approve(spender, max)).wait();
  }
}

/**
 * Set up wallet and config for E2E tests.
 */
export async function setupCliConfig(accountIndex: number = 0): Promise<void> {
  const account = TEST_ACCOUNTS[accountIndex];
  const homeDir = configDir;
  const cliConfigDir = join(homeDir, ".config", "chisiki-cli");
  await mkdir(cliConfigDir, { recursive: true });

  // Write config.toml
  const configToml = `[default]
wallet = "main"
rpc_url = "${RPC_URL}"
chain_id = 8453

[wallet.main]
address = "${account.address}"

[wallet.sub]
address = "${TEST_ACCOUNTS[1].address}"
`;
  await writeFile(join(cliConfigDir, "config.toml"), configToml);

  // Create encrypted wallet file with both test accounts
  // Use runCli to do this properly via the init + wallet add commands
  // But since wallet add requires interactive input, we'll build the file programmatically
  await buildWalletFile(cliConfigDir, [
    { name: "main", privateKey: account.pk },
    { name: "sub", privateKey: TEST_ACCOUNTS[1].pk },
  ]);
}

async function buildWalletFile(
  dir: string,
  wallets: { name: string; privateKey: string }[],
): Promise<void> {
  const { randomBytes, createCipheriv, pbkdf2Sync } = await import("node:crypto");
  const password = "test-password-e2e";
  const salt = randomBytes(32);
  const derivedKey = pbkdf2Sync(password, salt, 100_000, 32, "sha256");

  const MAGIC = Buffer.from("CHSK");
  const parts: Buffer[] = [MAGIC, Buffer.from([1]), salt];
  const countBuf = Buffer.alloc(2);
  countBuf.writeUInt16BE(wallets.length);
  parts.push(countBuf);

  for (const w of wallets) {
    const nameBuf = Buffer.from(w.name, "utf8");
    const keyBytes = Buffer.from(w.privateKey.replace(/^0x/, ""), "hex");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);
    const encrypted = Buffer.concat([cipher.update(keyBytes), cipher.final()]);
    const authTag = cipher.getAuthTag();
    parts.push(Buffer.from([nameBuf.length]), nameBuf, iv, Buffer.concat([encrypted, authTag]));
  }

  await writeFile(join(dir, "wallets.enc"), Buffer.concat(parts));
}

/**
 * Run a CLI command and return parsed output.
 */
export async function runCli(...args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number; json: any }> {
  const proc = Bun.spawn(["bun", "run", CLI, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      HOME: configDir,
      CHISIKI_MASTER_PASSWORD: "test-password-e2e",
      CHISIKI_RPC_URL: RPC_URL,
      NO_COLOR: "1",
    },
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  let json: any = null;
  try {
    json = JSON.parse(stdout.trim());
  } catch {}

  if (exitCode !== 0) {
    console.log(`[runCli FAIL] chisiki ${args.join(" ")}\n  stderr: ${stderr.trim()}`);
  }

  return { stdout, stderr, exitCode, json };
}
