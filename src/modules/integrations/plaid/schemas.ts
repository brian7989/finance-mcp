import * as z from "zod";

export const PlaidAccountSchema = z.object({
  account_id: z.string(),
  name: z.string(),
  mask: z.string().nullable(),
  type: z.string(),
  subtype: z.string().nullable(),
  balances: z.object({
    current: z.number().nullable(),
    available: z.number().nullable(),
    iso_currency_code: z.string().nullable(),
    unofficial_currency_code: z.string().nullable(),
    last_updated_datetime: z.string().nullish(),
  }),
});
export const AccountsResponseSchema = z.object({
  accounts: z.array(PlaidAccountSchema),
});
export const ItemResponseSchema = z.object({
  item: z.object({
    item_id: z.string(),
    institution_id: z.string().nullable(),
    consented_products: z.array(z.string()).nullish(),
    products: z.array(z.string()).optional(),
    billed_products: z.array(z.string()),
    available_products: z.array(z.string()),
  }),
});
export const InstitutionResponseSchema = z.object({
  institution: z.object({
    name: z.string(),
  }),
});
export const PlaidTransactionSchema = z.object({
  transaction_id: z.string(),
  account_id: z.string(),
  date: z.string(),
  name: z.string(),
  amount: z.number(),
  pending: z.boolean(),
  iso_currency_code: z.string().nullable(),
  unofficial_currency_code: z.string().nullable(),
  personal_finance_category: z
    .object({
      primary: z.string(),
    })
    .nullish(),
});
export const SyncResponseSchema = z.object({
  added: z.array(PlaidTransactionSchema),
  modified: z.array(PlaidTransactionSchema),
  removed: z.array(
    z.object({
      transaction_id: z.string(),
      account_id: z.string(),
    }),
  ),
  next_cursor: z.string(),
  has_more: z.boolean(),
});
export const HoldingsResponseSchema = z.object({
  accounts: z.array(PlaidAccountSchema),
  holdings: z.array(
    z.object({
      account_id: z.string(),
      security_id: z.string(),
      quantity: z.number(),
      institution_value: z.number(),
      institution_price_as_of: z.string().nullable(),
      iso_currency_code: z.string().nullable(),
      unofficial_currency_code: z.string().nullable(),
    }),
  ),
  securities: z.array(
    z.object({
      security_id: z.string(),
      name: z.string().nullable(),
      ticker_symbol: z.string().nullable(),
    }),
  ),
});
export const InvestmentActivityResponseSchema = z.object({
  total_investment_transactions: z.number().int(),
  investment_transactions: z.array(
    z.object({
      investment_transaction_id: z.string(),
      account_id: z.string(),
      date: z.string(),
      name: z.string(),
      amount: z.number(),
      type: z.string(),
      subtype: z.string(),
      iso_currency_code: z.string().nullable(),
      unofficial_currency_code: z.string().nullable(),
    }),
  ),
});
export type PlaidAccount = z.infer<typeof PlaidAccountSchema>;
export type PlaidTransaction = z.infer<typeof PlaidTransactionSchema>;
