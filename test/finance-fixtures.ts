import type { Account, Balance, Connection, Transaction } from "../src/finance/schemas.js";

export function fixtureConnection(id = "plaid/item_1"): Connection {
  return {
    id,
    provider: "plaid",
    institution: "Fixture Bank",
    status: "connected",
    capabilities: [
      "balances",
      "transactions",
    ],
    last_success_at: null,
    last_error: null,
    revision: crypto.randomUUID(),
  };
}
export function fixtureAccount(
  id = "plaid/item_1/account_1",
  type: Account["type"] = "cash",
): Account {
  return {
    id,
    connection_id: "plaid/item_1",
    provider_account_id: id.split("/").at(-1) ?? id,
    name: "Fixture account",
    mask: "1234",
    type,
    subtype: null,
    currency: "USD",
    active: true,
  };
}
export function fixtureBalance(
  accountId = "plaid/item_1/account_1",
  current: string | null = "100.00",
  fetchedAt = "2026-10-10T09:17:00.000Z",
): Balance {
  return {
    account_id: accountId,
    current,
    available: current,
    currency: "USD",
    fetched_at: fetchedAt,
    source_updated_at: null,
    completeness: current === null ? "partial" : "complete",
  };
}
export function fixtureTransaction(id = "plaid/item_1/transaction_1"): Transaction {
  return {
    id,
    account_id: "plaid/item_1/account_1",
    date: "2026-10-10",
    description: "Fixture purchase",
    amount: "-10.50",
    currency: "USD",
    pending: false,
    kind: "cash",
    category: "FOOD_AND_DRINK",
    fetched_at: "2026-10-10T09:17:00.000Z",
  };
}
export function fixturePlaidAccount() {
  return {
    account_id: "account_1",
    name: "Checking",
    mask: "1234",
    type: "depository",
    subtype: "checking",
    balances: {
      current: 100,
      available: 90,
      iso_currency_code: "USD",
      unofficial_currency_code: null,
    },
  };
}
export function fixturePlaidTransaction(id = "transaction_1", pending = false) {
  return {
    transaction_id: id,
    account_id: "account_1",
    date: "2026-10-10",
    name: "Purchase",
    amount: 10.5,
    pending,
    iso_currency_code: "USD",
    unofficial_currency_code: null,
  };
}
