import { decimal } from "../../finance/money.js";
import type { Account, Balance, Connection } from "../../finance/schemas.js";
import type { PlaidClient } from "./client.js";
import { readPlaidResponse } from "./client.js";
import { AccountsResponseSchema, type PlaidAccount } from "./schemas.js";

export async function readPlaidAccounts(
  client: PlaidClient,
  token: string,
  connection: Connection,
  live = false,
) {
  const data = await readPlaidResponse(
    AccountsResponseSchema,
    live
      ? client.accountsBalanceGet({
          access_token: token,
        })
      : client.accountsGet({
          access_token: token,
        }),
  );
  const fetchedAt = new Date().toISOString();
  return {
    accounts: data.accounts.map((account) => mapPlaidAccount(account, connection)),
    balances: data.accounts.map((account) => mapPlaidBalance(account, connection, fetchedAt)),
  };
}
export function accountId(connectionId: string, providerId: string): string {
  return `${connectionId}/${providerId}`;
}
export function mapPlaidAccount(account: PlaidAccount, connection: Connection): Account {
  return {
    id: accountId(connection.id, account.account_id),
    connection_id: connection.id,
    provider_account_id: account.account_id,
    name: account.name,
    mask: account.mask,
    type: classifyAccount(account),
    subtype: account.subtype,
    currency: account.balances.iso_currency_code ?? account.balances.unofficial_currency_code,
    active: true,
  };
}
export function mapPlaidBalance(
  account: PlaidAccount,
  connection: Connection,
  fetchedAt: string,
): Balance {
  return {
    account_id: accountId(connection.id, account.account_id),
    current: decimal(account.balances.current),
    available: decimal(account.balances.available),
    currency: account.balances.iso_currency_code ?? account.balances.unofficial_currency_code,
    fetched_at: fetchedAt,
    source_updated_at: account.balances.last_updated_datetime ?? null,
    completeness: account.balances.current === null ? "partial" : "complete",
  };
}
function classifyAccount(account: PlaidAccount): Account["type"] {
  if (account.subtype === "hsa") {
    return "hsa";
  }
  if (account.type === "depository") {
    return "cash";
  }
  if (account.type === "credit" || account.type === "loan" || account.type === "investment") {
    return account.type;
  }
  return "other";
}
