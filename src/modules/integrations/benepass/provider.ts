import { type Env, ownerSession } from "../../../config/env.js";
import type { FinanceContext } from "../../finance/context.js";
import type { Account, Balance, Holding, Snapshot } from "../../finance/schemas.js";
import { decimal } from "../../finance/services/money.js";
import type { FinanceProvider, LedgerChanges, ProviderMetadata } from "../provider.js";
import { BenepassClient } from "./client.js";
import { HsaReader } from "./readers/hsa.js";

export async function resolveBenepassProvider(context: FinanceContext): Promise<FinanceProvider> {
  return {
    readMetadata: readBenepassMetadata,
    readSnapshot: () => readBenepassSnapshot(context.env),
    readChanges: readBenepassChanges,
    disconnect: () => disconnectBenepass(context.env),
  };
}
export async function readBenepassSnapshot(env: Env): Promise<Snapshot> {
  const api = new BenepassClient(ownerSession(env));
  const hsa = await new HsaReader(api).investments({});
  const id = benepassAccountId(hsa);
  return {
    accounts: [
      mapHsaAccount(hsa, id),
    ],
    balances: [
      mapHsaBalance(hsa, id),
    ],
    holdings: hsa.holdings?.map((position) => mapHsaHolding(hsa, id, position)) ?? null,
  };
}
async function readBenepassMetadata(): Promise<ProviderMetadata> {
  return {
    institution: "Benepass",
    capabilities: [
      "balances",
      "holdings",
    ],
  };
}
async function readBenepassChanges(): Promise<LedgerChanges> {
  return {
    cash: null,
    investments: null,
  };
}
type HsaInvestments = Awaited<ReturnType<HsaReader["investments"]>>;
type HsaPosition = NonNullable<HsaInvestments["holdings"]>[number];

function benepassAccountId(hsa: HsaInvestments): string {
  return `benepass/${hsa.workspace_id}/${hsa.account_id}`;
}
function mapHsaAccount(hsa: HsaInvestments, id: string): Account {
  return {
    id,
    connection_id: "benepass",
    provider_account_id: hsa.account_id,
    name: "Benepass HSA",
    mask: null,
    type: "hsa",
    subtype: "hsa",
    currency: hsa.currency,
    active: true,
  };
}
function mapHsaBalance(hsa: HsaInvestments, id: string): Balance {
  return {
    account_id: id,
    current: hsa.total?.amount ?? null,
    available: hsa.cash?.amount ?? null,
    currency: hsa.currency,
    fetched_at: hsa.fetched_at,
    source_updated_at: null,
    completeness: hsa.status === "available" ? "complete" : "partial",
  };
}
function mapHsaHolding(hsa: HsaInvestments, id: string, position: HsaPosition): Holding {
  return {
    id: `${id}/${position.asset_id}`,
    account_id: id,
    symbol: position.symbol,
    name: position.asset_name,
    quantity: decimal(position.quantity),
    value: decimal(position.market_value),
    currency: hsa.currency,
    price_as_of: null,
    fetched_at: hsa.fetched_at,
  };
}

async function disconnectBenepass(env: Env): Promise<void> {
  await ownerSession(env).logout();
}
