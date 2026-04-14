import { ChisikiSDK } from "@chisiki/sdk";
import { resolveWalletName, resolveRpcUrl, resolveChainId, loadConfig } from "./config.js";
import { getPrivateKey } from "./wallet-store.js";
import type { GlobalOptions } from "../types/index.js";

export async function createSDK(options: GlobalOptions): Promise<ChisikiSDK> {
  const walletName = await resolveWalletName(options.wallet);
  const rpcUrl = resolveRpcUrl(options.rpcUrl);
  const chainId = resolveChainId(options.chainId);
  const privateKey = await getPrivateKey(walletName);
  return new ChisikiSDK({ privateKey, rpcUrl, chainId });
}

export async function resolveAddress(options: GlobalOptions, address?: string): Promise<string | undefined> {
  if (address) return address;
  const walletName = await resolveWalletName(options.wallet);
  const config = await loadConfig();
  return config.wallet[walletName]?.address;
}
