# GasVault Integration Design

## Overview

`@chisiki/sdk` v0.4.1 introduced GasVault — a mechanism that refunds ETH gas costs by consuming CKT deposited into the Gas Vault. The SDK exposes three new methods:

| Method | Description |
|--------|-------------|
| `depositGasVault(amountCKT)` | Deposit CKT into the Gas Vault (one-way, no withdrawals) |
| `getGasVaultBalance(addr?)` | Query available CKT balance in the Gas Vault |
| `executeWithRefund(target, data)` | Execute a transaction through GasVaultRouter for ETH gas refund |

The CLI needs to expose these capabilities. This document evaluates two approaches for integrating `executeWithRefund` and records the current decision.

## Approach 1: Standalone Command

Expose `executeWithRefund` as a dedicated subcommand under a `gas-vault` command group:

```
chisiki gas-vault deposit <amount>
chisiki gas-vault balance [address]
chisiki gas-vault execute-with-refund <target> <data>
```

### Pros

- Simple to implement — follows existing CLI patterns (one SDK method = one subcommand)
- No changes needed to existing commands

### Cons

- `execute-with-refund` requires raw contract address and ABI-encoded calldata as arguments
- Users (including AI agents) must manually encode calldata before invoking the command
- Poor ergonomics — the whole point of the CLI is to abstract away low-level contract interactions

## Approach 2: `--with-gasvault` Global Flag (Preferred)

Add a `--with-gasvault` flag to all transaction commands. When present, the CLI routes the transaction through GasVaultRouter automatically:

```
chisiki qa post-question --bounty 10 --with-gasvault
chisiki knowledge purchase 42 --with-gasvault
chisiki agent register --with-gasvault
```

### Pros

- Natural UX — users do not need to understand calldata encoding
- Works seamlessly with every existing transaction command
- AI agents can opt into gas refunds without changing their workflow

### Cons

- Requires the ability to obtain encoded calldata from each SDK method **without** sending the transaction
- Touches every transaction command (or requires a shared middleware in `createSDK`)

## Current Status

`@chisiki/sdk` v0.5.1 adds a prepared-write API for normal question posting, which unblocks the first CLI integration:

```typescript
const prepared = await sdk.preparePostQuestion(content, tags, reward, deadline);
await sdk.executePrepared(prepared, {
  transport: "gasvault",
  autoApprove: false,
  requireGasVault: true,
  gasLimit: 2_000_000n,
});
```

This is exposed as `chisiki qa post-question ... --with-gasvault`. The CLI intentionally uses `autoApprove: false`, matching the SDK release-note guidance that GasVault routing must not send surprise direct approval transactions. Users should satisfy CKT approval separately, for example with `chisiki token approve`.

The CLI also passes a conservative default gas limit for this route because the router performs refund quotation after the target call, and plain `eth_estimateGas` can under-estimate that post-action work on forked/local RPCs. Override it with `--gas-limit` if needed.

Other transaction commands still need corresponding SDK prepared-write helpers before they can support `--with-gasvault` ergonomically.

## Decision

- **`deposit` and `balance`**: Implement immediately as `gas-vault deposit` and `gas-vault balance` subcommands.
- **`qa post-question --with-gasvault`**: Implement with `preparePostQuestion()` and `executePrepared()`.
- **Other transaction commands**: Wait for SDK prepared-write helpers before adding `--with-gasvault`. Do **not** ship the low-level `execute-with-refund <target> <data>` subcommand — it provides little value over calling the contract directly and would need to be deprecated once broader `--with-gasvault` support is available.
