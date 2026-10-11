import * as z from "zod";
import { identifier } from "./parsing.js";

export const BalanceSchema = z.object({
  key: z.string(),
  amount: z
    .union([
      z.string(),
      z.number(),
    ])
    .optional(),
  formatted_local_amount: z.string().optional(),
});

export const BenefitSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  benefit_type: z.string().optional(),
  key: z.string().optional(),
});

export const EnrollmentSchema = z.object({
  benefit: BenefitSchema.optional(),
  local_max_expense_amount: z
    .union([
      z.string(),
      z.number(),
    ])
    .nullish(),
  max_expense_amount: z
    .union([
      z.string(),
      z.number(),
    ])
    .nullish(),
});

export const AccountSchema = z.object({
  id: z.string(),
  key: z.string().optional(),
  type: z.string().optional(),
  account_type: z.string().optional(),
  name: z.string().optional(),
  balances: z.array(BalanceSchema).optional(),
  enrollment: EnrollmentSchema.nullable().optional(),
});

export type Account = z.infer<typeof AccountSchema>;
export type Balance = z.infer<typeof BalanceSchema>;

export const WorkspaceSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

export const DerivedBenefitSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  benefit_type: z.string().nullable(),
  account_id: z.string(),
  available_balance: z
    .union([
      z.string(),
      z.number(),
    ])
    .nullable(),
  formatted_available_balance: z.string().nullable(),
  max_per_expense: z
    .union([
      z.string(),
      z.number(),
    ])
    .nullable(),
});

export type DerivedBenefit = z.infer<typeof DerivedBenefitSchema>;

export const workspaceIdField = identifier
  .optional()
  .describe("Workspace id; required when workspace selection is ambiguous");
