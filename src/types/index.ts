export type {
  ChisikiConfig,
  ChisikiErrorCode,
  AgentInfo,
  AgentStatus,
  QuestionInfo,
  AnswerInfo,
  KnowledgeInfo,
  PurchaseInfo,
  TransactionRecord,
  ReputationMetrics,
  ProtocolRules,
  TxResult,
  PostQuestionResult,
  PostPremiumQuestionResult,
  RegisterResult,
  ListKnowledgeResult,
  CommitData,
  AutoEarnConfig,
  AutoEarnReport,
  AutoSolveConfig,
} from "@chisiki/sdk";

export { ChisikiError } from "@chisiki/sdk";

export interface WalletEntry {
  name: string;
  address: string;
}

export interface WalletConfig {
  address: string;
}

export interface AppConfig {
  default: {
    wallet: string;
    rpc_url: string;
    chain_id: number;
  };
  wallet: Record<string, WalletConfig>;
}

export interface GlobalOptions {
  wallet?: string;
  rpcUrl?: string;
  chainId?: number;
  human?: boolean;
  pretty?: boolean;
  quiet?: boolean;
}

export interface EncryptedWalletFile {
  salt: Uint8Array;
  entries: EncryptedWalletEntry[];
}

export interface EncryptedWalletEntry {
  name: string;
  iv: Uint8Array;
  encryptedKey: Uint8Array;
}
