import { type Env, ownerSession } from "../../../config/env.js";
import type { Snapshot } from "../../finance/schemas.js";
import { decimal } from "../../finance/services/money.js";
import { BenepassClient } from "./client.js";
import { HsaReader } from "./readers/hsa.js";

export async function readBenepassSnapshot(env: Env): Promise<Snapshot> {
  const api = new BenepassClient(ownerSession(env));
  const hsa = await new HsaReader(api).investments({});
  const accountId = `benepass/${hsa.workspace_id}/${hsa.account_id}`;
  return {
    accounts: [
      {
        id: accountId,
        connection_id: "benepass",
        provider_account_id: hsa.account_id,
        name: "Benepass HSA",
        mask: null,
        type: "hsa",
        subtype: "hsa",
        currency: hsa.currency,
        active: true,
      },
    ],
    balances: [
      {
        account_id: accountId,
        current: hsa.total?.amount ?? null,
        available: hsa.cash?.amount ?? null,
        currency: hsa.currency,
        fetched_at: hsa.fetched_at,
        source_updated_at: null,
        completeness: hsa.status === "available" ? "complete" : "partial",
      },
    ],
    holdings:
      hsa.holdings?.map((position) => ({
        id: `${accountId}/${position.asset_id}`,
        account_id: accountId,
        symbol: position.symbol,
        name: position.asset_name,
        quantity: decimal(position.quantity),
        value: decimal(position.market_value),
        currency: hsa.currency,
        price_as_of: null,
        fetched_at: hsa.fetched_at,
      })) ?? null,
  };
}
