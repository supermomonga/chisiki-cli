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
  ChisikiTransport,
  ApprovalRequirement,
  PreparedWrite,
  ExecutePreparedOptions,
  PostQuestionResult,
  PostPremiumQuestionResult,
  RegisterResult,
  ListKnowledgeResult,
  PurchaseKnowledgeResult,
  DeliveryConfig,
  QualifiedMerchantStats,
  PrivateKnowledgeMeta,
  PurchaseDeliveryState,
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
    salt_idempotency?: boolean;
    salt_seed?: string;
  };
  wallet: Record<string, WalletConfig>;
}

export type OutputFormat = "pretty" | "json";

export interface GlobalOptions {
  wallet?: string;
  rpcUrl?: string;
  chainId?: number;
  format?: OutputFormat;
  quiet?: boolean;
  withGasvault?: boolean;
  gasLimit?: number;
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
