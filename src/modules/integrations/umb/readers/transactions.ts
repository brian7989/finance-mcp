import Big from "big.js";
import type * as z from "zod";
import type { Transaction } from "../../../finance/schemas.js";
import type { TransactionChanges } from "../../provider.js";
import type { UmbClient } from "../client.js";
import { UmbTransactionPageSchema, type UmbTransactionSchema, UmbYearsSchema } from "../schemas.js";
import { umbCashAccountId } from "./accounts.js";

type UmbTransaction = z.infer<typeof UmbTransactionSchema>;
export async function readUmbTransactions(client: UmbClient): Promise<TransactionChanges> {
  const history = await client.read("/Transactions/GetYearsWithAccounts", UmbYearsSchema);
  const years = Object.keys(history.YearsWithAccounts).sort().reverse();
  const records = new Map<string, UmbTransaction>();
  for (const year of years) {
    for (const item of await readYear(client, year)) {
      if (item.AccountIsHsa) {
        records.set(item.Id, item);
      }
    }
  }
  const fetchedAt = new Date().toISOString();
  const source = [
    ...records.values(),
  ];
  return {
    transactions: source
      .filter((item) => !item.IsDenied)
      .map((item) => mapUmbTransaction(item, fetchedAt)),
    removed: source.filter((item) => item.IsDenied).map((item) => `umb/${item.Id}`),
    cursor: fetchedAt,
  };
}
export function mapUmbTransaction(item: UmbTransaction, fetchedAt: string): Transaction {
  return {
    id: `umb/${item.Id}`,
    account_id: umbCashAccountId(item.AccountId),
    date: item.Date.slice(0, 10),
    description: item.Description || item.Type,
    amount: new Big(item.Amount).toFixed(),
    currency: "USD",
    pending: item.IsPending,
    kind: "cash",
    category: item.Type,
    fetched_at: fetchedAt,
  };
}
async function readYear(client: UmbClient, year: string): Promise<UmbTransaction[]> {
  const result: UmbTransaction[] = [];
  for (let page = 1; page <= 25; ++page) {
    const response = await client.read(transactionPagePath(year, page), UmbTransactionPageSchema);
    result.push(...response.Data);
    if (page >= response.TotalPages) {
      return result;
    }
  }
  throw new Error("UMB history exceeds the refresh budget");
}
function transactionPagePath(year: string, page: number): string {
  const query = new URLSearchParams({
    "pageParams.pageNo": String(page),
    "pageParams.pageSize": "100",
    "filter.year": year,
    "filter.showZeroTransactions": "true",
    "filter.statuses[0]": "Approved/Posted",
    "filter.statuses[1]": "Pending/Processing",
    "filter.statuses[2]": "Denied",
  });
  return `/Transactions/GetPage?${query}`;
}
