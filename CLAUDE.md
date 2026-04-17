# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

chisiki-cli は Chisiki Protocol (Base L2 上の AI エージェント向け分散型ナレッジマーケットプレイス) の CLI クライアント。`@chisiki/sdk` の全 56 メソッドをコマンドラインから利用可能にする。AI エージェントの自律利用を第一に設計。

## Tech Stack

- **Runtime**: Bun (mise.toml で管理)
- **Language**: TypeScript
- **CLI Framework**: Cliffy v1.x (`@cliffy/command`, JSR 経由で `bunx jsr add`)
- **SDK**: `@chisiki/sdk` (ethers v6)
- **Config format**: TOML (`smol-toml`)
- **Encryption**: Node.js 標準 `crypto` モジュール (AES-256-GCM)

## Commands

```bash
bun install              # 依存インストール
bun run src/main.ts      # 開発実行
bun test                 # テスト実行
bun build                # ビルド
```

## Architecture

エントリポイントは `src/main.ts`。Cliffy の `Command` で 16 サブコマンドグループを登録する。

- `src/commands/` — 各サブコマンド (agent, token, qa, knowledge, tempo, hof, reputation, insurance, report, protocol, auto, listen, wallet, config, init, gas-vault)
- `src/lib/sdk.ts` — ChisikiSDK のインスタンス化ラッパー。ウォレット解決 → 秘密鍵復号 → SDK 初期化を担当
- `src/lib/wallet-store.ts` — AES-256-GCM 暗号化ウォレットファイルの読み書き。PBKDF2 (100k iterations) でマスターパスワードから鍵導出
- `src/lib/config.ts` — `~/.config/chisiki-cli/config.toml` の読み書き
- `src/lib/output.ts` — JSON (デフォルト) / テーブル (`--human`) の出力切り替え

## Key Design Decisions

- **出力はデフォルト JSON**。`--human` でテーブル表示。`--pretty` で JSON 整形。エラーは stderr、結果は stdout
- **秘密鍵は暗号化ファイル** (`~/.config/chisiki-cli/wallets.enc`) に保存。OS キーチェーンは AI エージェントの自律利用時に毎回人間の確認が入るため不採用
- **マスターパスワード**: 環境変数 `CHISIKI_MASTER_PASSWORD` > 対話プロンプト の優先順
- **設定優先順位**: CLI 引数 > 環境変数 > config.toml > デフォルト値
- **マルチウォレット**: `--wallet <name>` で切り替え (AWS CLI プロファイル風)
- すべてのプロトコル操作コマンドは非対話的に使えることを常に確認する

## Specification

詳細な仕様は `docs/specification.md` を参照。
