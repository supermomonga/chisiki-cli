import { ChisikiSDK } from "@chisiki/sdk";
import { resolveWalletName, resolveRpcUrl, resolveChainId, loadConfig } from "./config.js";
import { getPrivateKey } from "./wallet-store.js";
import type { GlobalOptions } from "../types/index.js";

export async function createSDK(options: GlobalOptions): Promise<ChisikiSDK> {
  const walletName = await resolveWalletName(options.wallet);
  const rpcUrl = resolveRpcUrl(options.rpcUrl);
  const chainId = resolveChainId(options.chainId);
  const privateKey = await getPrivateKey(walletName);
  const sdk = new ChisikiSDK({ privateKey, rpcUrl, chainId });

  // Workaround for flaky eth_estimateGas on forked Anvil (Chisiki1/chisiki-sdk#1).
  // UUPS proxy DELEGATECALL gas estimates are non-deterministic in fork mode.
  const multiplier = parseFloat(process.env.CHISIKI_GAS_ESTIMATE_MULTIPLIER ?? "");
  if (multiplier > 0) {
    const origEstimate = sdk.provider.estimateGas.bind(sdk.provider);
    sdk.provider.estimateGas = async (tx) => {
      const estimate = await origEstimate(tx);
      return BigInt(Math.ceil(Number(estimate) * multiplier));
    };
  }

  return sdk;
}

export async function resolveAddress(options: GlobalOptions, address?: string): Promise<string | undefined> {
  if (address) return address;
  const walletName = await resolveWalletName(options.wallet);
  const config = await loadConfig();
  return config.wallet[walletName]?.address;
}
