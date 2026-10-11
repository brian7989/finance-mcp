import type * as z from "zod";
import type { Holding, Transaction } from "../../../finance/schemas.js";
import { decimal } from "../../../finance/services/money.js";
import type { InvestmentChanges } from "../../provider.js";
import { type PlaidClient, readPlaidResponse } from "../client.js";
import { HoldingsResponseSchema, InvestmentActivityResponseSchema } from "../schemas.js";
import { accountId } from "./accounts.js";

type HoldingsData = z.infer<typeof HoldingsResponseSchema>;
type ProviderHolding = HoldingsData["holdings"][number];
type ProviderSecurity = HoldingsData["securities"][number];
type InvestmentTransaction = z.infer<
  typeof InvestmentActivityResponseSchema
>["investment_transactions"][number];
type InvestmentWindow = {
  start_date: string;
  end_date: string;
};

export async function readPlaidHoldings(
  client: PlaidClient,
  token: string,
  connectionId: string,
): Promise<Holding[]> {
  const data = await readPlaidResponse(
    HoldingsResponseSchema,
    client.investmentsHoldingsGet({
      access_token: token,
    }),
  );
  const securities = new Map(
    data.securities.map((security) => [
      security.security_id,
      security,
    ]),
  );
  const fetchedAt = new Date().toISOString();
  return data.holdings.map((holding) =>
    mapPlaidHolding(holding, securities.get(holding.security_id), connectionId, fetchedAt),
  );
}
function mapPlaidHolding(
  holding: ProviderHolding,
  security: ProviderSecurity | undefined,
  connectionId: string,
  fetchedAt: string,
): Holding {
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
}
export async function readInvestmentActivity(
  client: PlaidClient,
  token: string,
  connectionId: string,
  lastSuccessAt: string | null = null,
): Promise<InvestmentChanges> {
  const window = investmentWindow(lastSuccessAt);
  const transactions = await readInvestmentPages(client, token, connectionId, window);
  return {
    transactions,
    ...window,
  };
}
export function investmentWindow(lastSuccessAt: string | null, now = Date.now()): InvestmentWindow {
  const earliest = now - 730 * 86400000;
  const overlap = lastSuccessAt ? Date.parse(lastSuccessAt) - 90 * 86400000 : earliest;
  return {
    start_date: new Date(Math.max(earliest, overlap)).toISOString().slice(0, 10),
    end_date: new Date(now).toISOString().slice(0, 10),
  };
}
async function readInvestmentPages(
  client: PlaidClient,
  token: string,
  connectionId: string,
  window: InvestmentWindow,
): Promise<Transaction[]> {
  const transactions: Transaction[] = [];
  const fetchedAt = new Date().toISOString();
  for (let offset = 0; offset < 10000; offset += 500) {
    const data = await readPlaidResponse(
      InvestmentActivityResponseSchema,
      client.investmentsTransactionsGet({
        access_token: token,
        ...window,
        options: {
          count: 500,
          offset,
        },
      }),
    );
    transactions.push(
      ...data.investment_transactions.map((transaction) =>
        mapInvestmentTransaction(transaction, connectionId, fetchedAt),
      ),
    );
    if (offset + data.investment_transactions.length >= data.total_investment_transactions) {
      return transactions;
    }
  }
  throw new Error("Investment activity page limit reached");
}
function mapInvestmentTransaction(
  transaction: InvestmentTransaction,
  connectionId: string,
  fetchedAt: string,
): Transaction {
  return {
    id: accountId(connectionId, transaction.investment_transaction_id),
    account_id: accountId(connectionId, transaction.account_id),
    date: transaction.date,
    description: transaction.name,
    amount: decimal(transaction.amount) ?? "0",
    currency: transaction.iso_currency_code ?? transaction.unofficial_currency_code,
    pending: false,
    kind: "investment",
    category: `${transaction.type}/${transaction.subtype}`,
    fetched_at: fetchedAt,
  };
}
