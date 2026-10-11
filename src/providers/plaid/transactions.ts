import { decimal, negateAmount } from "../../finance/money.js";
import type { Transaction } from "../../finance/schemas.js";
import { accountId } from "./accounts.js";
import type { PlaidTransaction } from "./schemas.js";

export function mapPlaidTransaction(
  transaction: PlaidTransaction,
  connectionId: string,
): Transaction {
  return {
    id: accountId(connectionId, transaction.transaction_id),
    account_id: accountId(connectionId, transaction.account_id),
    date: transaction.date,
    description: transaction.name,
    // Plaid cash outflows are positive. Our cash ledger uses inflows positive.
    amount: negateAmount(decimal(transaction.amount) ?? "0"),
    currency: transaction.iso_currency_code ?? transaction.unofficial_currency_code,
    pending: transaction.pending,
    kind: "cash",
    category: transaction.personal_finance_category?.primary ?? null,
    fetched_at: new Date().toISOString(),
  };
}
