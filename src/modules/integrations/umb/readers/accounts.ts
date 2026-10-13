import Big from "big.js";
import type { Account, Balance, Connection, Snapshot } from "../../../finance/schemas.js";
import type { UmbClient } from "../client.js";
import { type UmbAccount, UmbAccountsSchema } from "../schemas.js";

export async function readUmbSnapshot(
  client: UmbClient,
  connection: Connection,
): Promise<Snapshot> {
  const source = await client.read("/Accounts/List", UmbAccountsSchema);
  return mapUmbAccounts(source, connection, new Date().toISOString());
}
export function mapUmbAccounts(
  source: UmbAccount[],
  connection: Connection,
  fetchedAt: string,
): Snapshot {
  const accounts: Account[] = [];
  const balances: Balance[] = [];
  for (const item of source.filter((account) => account.IsHsa)) {
    const cash = makeAccount(item, connection, "cash");
    accounts.push(cash);
    balances.push(
      makeBalance(
        cash,
        cashBalance(item),
        item.HideDollarAmount ? null : new Big(item.AvailableBalance).toFixed(),
        fetchedAt,
      ),
    );
    if (item.InvestmentAccountId !== null || item.PortfolioBalance > 0) {
      const investments = makeAccount(item, connection, "investments");
      accounts.push(investments);
      balances.push(
        makeBalance(
          investments,
          item.HideDollarAmount ? null : new Big(item.PortfolioBalance).toFixed(),
          null,
          fetchedAt,
        ),
      );
    }
  }
  return {
    accounts,
    balances,
    holdings: null,
  };
}
export function umbCashAccountId(id: number): string {
  return `umb/${id}/cash`;
}
function makeAccount(
  item: UmbAccount,
  connection: Connection,
  part: "cash" | "investments",
): Account {
  return {
    id: `umb/${item.AccountId}/${part}`,
    connection_id: connection.id,
    provider_account_id: `${item.AccountId}/${part}`,
    name: part === "cash" ? "UMB HSA Cash" : "UMB HSA Investments",
    mask: accountSuffix(item.ReassociationAcctNum),
    type: part === "cash" ? "hsa" : "investment",
    subtype: part === "cash" ? "hsa cash" : "hsa investments",
    currency: "USD",
    active: item.Active,
  };
}
function cashBalance(item: UmbAccount): string | null {
  if (item.HideDollarAmount) {
    return null;
  }
  const cash = new Big(item.TotalBalance).minus(item.PortfolioBalance);
  if (cash.lt(0)) {
    throw new Error("Inconsistent UMB balances");
  }
  return cash.toFixed();
}
function accountSuffix(number: string): string | null {
  const match = /^[\d*]*(\d{4})$/.exec(number.trim());
  return match?.[1] ?? null;
}
function makeBalance(
  account: Account,
  current: string | null,
  available: string | null,
  fetchedAt: string,
): Balance {
  return {
    account_id: account.id,
    current,
    available,
    currency: "USD",
    fetched_at: fetchedAt,
    source_updated_at: null,
    completeness: current === null ? "partial" : "complete",
  };
}
