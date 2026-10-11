import * as z from "zod";
import { identifier } from "../parsing.js";
import { workspaceIdField } from "./accounts.js";

const decimal = z.string().regex(/^-?\d+(?:\.\d+)?$/);

// The provider sends decimal strings. Keep them as strings to avoid rounding money.
export const PortfolioBalanceSchema = z.object({
  id: identifier,
  currency: z.string().min(1),
  balance: decimal,
  balance_formatted: z.string(),
  cash_balance: decimal,
  cash_balance_formatted: z.string(),
  account_balance: decimal,
  account_balance_formatted: z.string(),
  total_value: decimal,
  total_value_formatted: z.string(),
  pending_transfer_in: decimal.nullable(),
  pending_transfer_out: decimal.nullable().optional(),
});

export const PositionSchema = z.object({
  asset_id: z.string(),
  symbol: z.string(),
  asset_name: z.string().nullable(),
  quantity: decimal,
  market_value: decimal,
  market_value_formatted: z.string(),
  current_price: decimal,
  current_price_formatted: z.string(),
  cost_basis: decimal,
  cost_basis_formatted: z.string(),
  unrealized_profit_loss: decimal,
  unrealized_profit_loss_formatted: z.string(),
  unrealized_profit_loss_percent: decimal,
});
export const PositionsSchema = z.object({
  data: z.array(PositionSchema),
});

export const HsaInputSchema = z.object({
  account_id: identifier
    .optional()
    .describe("HSA account id; required if there are multiple HSA accounts"),
  workspace_id: workspaceIdField,
});

export const AmountSchema = z.object({
  amount: decimal,
  formatted: z.string(),
});
export const HsaSummarySchema = z.object({
  account_id: identifier,
  workspace_id: identifier,
  fetched_at: z.iso.datetime(),
  status: z.enum([
    "available",
    "partial",
    "unavailable",
  ]),
  currency: z.string().nullable(),
  cash: AmountSchema.nullable(),
  investments: AmountSchema.nullable().describe(
    "Investment account value, including brokerage cash",
  ),
  brokerage_cash: AmountSchema.nullable().describe("Included in investments; do not add again"),
  total: AmountSchema.nullable().describe("Provider total: HSA cash plus investments"),
  pending_transfer_in: decimal.nullable(),
  pending_transfer_out: decimal.nullable(),
  availability_reason: z.string().nullable(),
  valuation_note: z.string(),
});
export const HsaInvestmentsSchema = HsaSummarySchema.extend({
  holdings: z.array(PositionSchema).nullable(),
  holdings_status: z.enum([
    "available",
    "unavailable",
  ]),
});

export const HsaDetailsSchema = z.object({
  account_number: z.string().nullable(),
  routing_number: z.string().nullable(),
  status: z.string().nullable(),
});
