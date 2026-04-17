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

## Current Blocker

**Approach 2 cannot be implemented with the current SDK design.**

The SDK methods (e.g., `sdk.postQuestion()`, `sdk.purchase()`) build, send, and wait for the transaction in a single call. There is no way to intercept the transaction before submission to extract the `target` address and encoded `data` needed by `executeWithRefund(target, data)`.

To unblock Approach 2, the SDK would need a `populateTransaction`-style API that returns the unsigned transaction (target + calldata) without broadcasting it. For example:

```typescript
// Hypothetical SDK API
const tx = await sdk.populatePostQuestion(title, body, bounty, tags);
// tx = { to: "0x...", data: "0x..." }
const result = await sdk.executeWithRefund(tx.to, tx.data);
```

## Decision

- **`deposit` and `balance`**: Implement immediately as `gas-vault deposit` and `gas-vault balance` subcommands.
- **`executeWithRefund`**: Wait for SDK to provide a populateTransaction-style API, then implement as the `--with-gasvault` global flag. Do **not** ship the low-level `execute-with-refund <target> <data>` subcommand — it provides little value over calling the contract directly and would need to be deprecated once `--with-gasvault` is available.
