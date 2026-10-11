import { decimal } from "../../finance/money.js";
import type { Holding, Transaction } from "../../finance/schemas.js";
import { accountId } from "./accounts.js";
import type { PlaidClient } from "./client.js";
import { HoldingsResponseSchema, InvestmentActivityResponseSchema } from "./schemas.js";

export async function readPlaidHoldings(
  client: PlaidClient,
  token: string,
  connectionId: string,
): Promise<Holding[]> {
  const data = await client(
    "/investments/holdings/get",
    {
      access_token: token,
    },
    HoldingsResponseSchema,
  );
  const fetchedAt = new Date().toISOString();
  return data.holdings.map((holding) => {
    const security = data.securities.find((value) => value.security_id === holding.security_id);
    return {
      id: accountId(connectionId, `${holding.account_id}/${holding.security_id}`),
      account_id: accountId(connectionId, holding.account_id),
      symbol: security?.ticker_symbol ?? null,
      name: security?.name ?? null,
      quantity: decimal(holding.quantity),
      value: decimal(holding.institution_value),
      currency: holding.iso_currency_code ?? holding.unofficial_currency_code,
      price_as_of: holding.institution_price_as_of,
      fetched_at: fetchedAt,
    };
  });
}
export async function readInvestmentActivity(
  client: PlaidClient,
  token: string,
  connectionId: string,
): Promise<Transaction[]> {
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10);
  const transactions: Transaction[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const data = await client(
      "/investments/transactions/get",
      {
        access_token: token,
        start_date: startDate,
        end_date: endDate,
        options: {
          count: 500,
          offset,
        },
      },
      InvestmentActivityResponseSchema,
    );
    for (const transaction of data.investment_transactions) {
      transactions.push({
        id: accountId(connectionId, transaction.investment_transaction_id),
        account_id: accountId(connectionId, transaction.account_id),
        date: transaction.date,
        description: transaction.name,
        amount: decimal(transaction.amount) ?? "0",
        currency: transaction.iso_currency_code ?? transaction.unofficial_currency_code,
        pending: false,
        kind: "investment",
        category: `${transaction.type}/${transaction.subtype}`,
        fetched_at: new Date().toISOString(),
      });
    }
    if (offset + data.investment_transactions.length >= data.total_investment_transactions) {
      return transactions;
    }
  }
  throw new Error("Investment activity page limit reached");
}
