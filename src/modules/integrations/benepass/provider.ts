import { ApiHttpError, SchemaError } from "../../../common/errors.js";
import { type Env, ownerSession } from "../../../config/env.js";
import type { FinanceContext } from "../../finance/context.js";
import type { Account, Balance, Holding, Snapshot } from "../../finance/schemas.js";
import { addAmounts, decimal } from "../../finance/services/money.js";
import type { FinanceProvider, LedgerChanges, ProviderMetadata } from "../provider.js";
import { BenepassClient } from "./client.js";
import { HsaReader } from "./readers/hsa.js";

type HsaInvestments = Awaited<ReturnType<HsaReader["investments"]>>;
type HsaPosition = NonNullable<HsaInvestments["holdings"]>[number];
type HsaComponent = "cash" | "investments";

export async function resolveBenepassProvider(context: FinanceContext): Promise<FinanceProvider> {
  return {
    readMetadata: readBenepassMetadata,
    readSnapshot: () => readBenepassSnapshot(context.env),
    readChanges: readBenepassChanges,
    disconnect: () => disconnectBenepass(context.env),
  };
}
export async function readBenepassSnapshot(env: Env): Promise<Snapshot> {
  const reader = new HsaReader(new BenepassClient(ownerSession(env)));
  const hsa = await reader.investments({});
  const cashMask = await readCashAccountMask(reader, hsa);
  return buildHsaSnapshot(hsa, cashMask);
}
export function buildHsaSnapshot(hsa: HsaInvestments, cashMask: string | null): Snapshot {
  assertComponentTotal(hsa);
  return {
    accounts: [
      mapHsaAccount(hsa, "cash", cashMask),
      mapHsaAccount(hsa, "investments", null),
    ],
    balances: [
      mapHsaBalance(hsa, "cash"),
      mapHsaBalance(hsa, "investments"),
    ],
    holdings: hsa.holdings?.map((position) => mapHsaHolding(hsa, position)) ?? null,
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
async function readCashAccountMask(reader: HsaReader, hsa: HsaInvestments): Promise<string | null> {
  try {
    const details = await reader.accountDetails({
      workspace_id: hsa.workspace_id,
    });
    return accountNumberSuffix(details.account_number);
  } catch (error) {
    if (error instanceof ApiHttpError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
function accountNumberSuffix(number: string | null): string | null {
  const digits = number?.replace(/[\s-]/g, "");
  return digits && /^\d{4,}$/.test(digits) ? digits.slice(-4) : null;
}
function assertComponentTotal(hsa: HsaInvestments): void {
  if (!hsa.cash || !hsa.investments || !hsa.total) {
    return;
  }
  const sum = addAmounts(hsa.cash.amount, hsa.investments.amount);
  if (sum !== decimal(hsa.total.amount)) {
    throw new SchemaError("Benepass cash and investments do not reconcile to the reported total");
  }
}
function benepassAccountId(hsa: HsaInvestments, component: HsaComponent): string {
  return `benepass/${hsa.workspace_id}/${hsa.account_id}/${component}`;
}
function mapHsaAccount(hsa: HsaInvestments, component: HsaComponent, mask: string | null): Account {
  return {
    id: benepassAccountId(hsa, component),
    connection_id: "benepass",
    provider_account_id: `${hsa.account_id}/${component}`,
    name: component === "cash" ? "Benepass HSA Cash" : "Benepass HSA Investments",
    mask,
    type: "hsa",
    subtype: component === "cash" ? "hsa cash" : "hsa investments",
    currency: hsa.currency,
    active: true,
  };
}
function mapHsaBalance(hsa: HsaInvestments, component: HsaComponent): Balance {
  const amount = hsa[component]?.amount ?? null;
  return {
    account_id: benepassAccountId(hsa, component),
    current: amount,
    available: component === "cash" ? amount : null,
    currency: hsa.currency,
    fetched_at: hsa.fetched_at,
    source_updated_at: null,
    completeness: amount === null ? "partial" : "complete",
  };
}
function mapHsaHolding(hsa: HsaInvestments, position: HsaPosition): Holding {
  const id = benepassAccountId(hsa, "investments");
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
