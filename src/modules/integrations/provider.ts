import type { Connection, Snapshot, Transaction } from "../finance/schemas.js";

export type TransactionChanges = {
  transactions: Transaction[];
  removed: string[];
  cursor: string;
};
export type InvestmentChanges = {
  transactions: Transaction[];
  start_date: string;
  end_date: string;
};
export type LedgerChanges = {
  cash: TransactionChanges | null;
  investments: InvestmentChanges | null;
};
export type ProviderMetadata = {
  institution: string;
  capabilities: Connection["capabilities"];
};

export interface FinanceProvider {
  readMetadata(): Promise<ProviderMetadata>;
  readSnapshot(connection: Connection): Promise<Snapshot>;
  readChanges(connection: Connection, cursor: string | null): Promise<LedgerChanges>;
  disconnect(): Promise<void>;
}
