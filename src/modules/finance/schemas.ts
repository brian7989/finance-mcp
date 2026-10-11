import * as z from "zod";

export const DecimalSchema = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?$/)
  .max(100);
export const CurrencySchema = z.string().min(1).max(20);
export const ProviderSchema = z.enum([
  "plaid",
  "benepass",
]);
export const CapabilitySchema = z.enum([
  "balances",
  "transactions",
  "holdings",
  "investment_activity",
]);
export const ConnectionSchema = z.object({
  id: z.string(),
  provider: ProviderSchema,
  institution: z.string(),
  status: z.enum([
    "connected",
    "needs_reconnection",
    "disconnected",
  ]),
  capabilities: z.array(CapabilitySchema),
  last_success_at: z.iso.datetime().nullable(),
  last_error: z.string().nullable(),
  revision: z.string(),
});
export const AccountSchema = z.object({
  id: z.string(),
  connection_id: z.string(),
  provider_account_id: z.string(),
  name: z.string(),
  mask: z.string().nullable(),
  type: z.enum([
    "cash",
    "credit",
    "loan",
    "investment",
    "hsa",
    "other",
  ]),
  subtype: z.string().nullable(),
  currency: CurrencySchema.nullable(),
  active: z.boolean(),
});
export const PreferenceSchema = z.object({
  account_id: z.string(),
  label: z.string().max(100).nullable(),
  include_in_net_worth: z.boolean(),
  include_in_spending: z.boolean(),
});
export const BalanceSchema = z.object({
  account_id: z.string(),
  current: DecimalSchema.nullable(),
  available: DecimalSchema.nullable(),
  currency: CurrencySchema.nullable(),
  fetched_at: z.iso.datetime(),
  source_updated_at: z.string().nullable(),
  completeness: z.enum([
    "complete",
    "partial",
  ]),
});
export const TransactionSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  date: z.string(),
  description: z.string(),
  amount: DecimalSchema,
  currency: CurrencySchema.nullable(),
  pending: z.boolean(),
  kind: z.enum([
    "cash",
    "investment",
  ]),
  category: z.string().nullable(),
  fetched_at: z.iso.datetime(),
});
export const HoldingSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  symbol: z.string().nullable(),
  name: z.string().nullable(),
  quantity: DecimalSchema.nullable(),
  value: DecimalSchema.nullable(),
  currency: CurrencySchema.nullable(),
  price_as_of: z.string().nullable(),
  fetched_at: z.iso.datetime(),
});
export const SnapshotSchema = z.object({
  accounts: z.array(AccountSchema),
  balances: z.array(BalanceSchema),
  holdings: z.array(HoldingSchema).nullable(),
});
export const QuerySchema = z
  .object({
    account_id: z.string().optional(),
    start_date: z.iso.date().optional(),
    end_date: z.iso.date().optional(),
    limit: z.number().int().min(1).max(500).default(100),
    offset: z.number().int().min(0).max(100000).default(0),
  })
  .refine(
    (query) => !query.start_date || !query.end_date || query.start_date <= query.end_date,
    "start_date must not follow end_date",
  );
export type Connection = z.infer<typeof ConnectionSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type Preference = z.infer<typeof PreferenceSchema>;
export type Balance = z.infer<typeof BalanceSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type Holding = z.infer<typeof HoldingSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type Query = z.infer<typeof QuerySchema>;
export type Capability = z.infer<typeof CapabilitySchema>;
