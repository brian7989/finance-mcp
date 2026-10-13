import * as z from "zod";

export const UmbAccountSchema = z.object({
  AccountId: z.number().int().positive(),
  AccountName: z.string(),
  ReassociationAcctNum: z.string(),
  IsHsa: z.boolean(),
  Active: z.boolean(),
  HideDollarAmount: z.boolean(),
  TotalBalance: z.number(),
  AvailableBalance: z.number(),
  PortfolioBalance: z.number().nonnegative(),
  InvestmentAccountId: z.string().nullable(),
});
export type UmbAccount = z.infer<typeof UmbAccountSchema>;
export const UmbAccountsSchema = z.array(UmbAccountSchema);
export const UmbYearsSchema = z.object({
  YearsWithAccounts: z.record(
    z.string().regex(/^\d{4}$/),
    z.array(
      z.object({
        AccountId: z.number().int().positive(),
      }),
    ),
  ),
});
export const UmbTransactionSchema = z.object({
  Id: z.string().min(1),
  AccountId: z.number().int().positive(),
  AccountIsHsa: z.boolean(),
  Date: z.string().regex(/^\d{4}-\d{2}-\d{2}T/),
  Description: z.string(),
  Type: z.string(),
  Amount: z.number(),
  IsDenied: z.boolean(),
  IsPending: z.boolean(),
});
export const UmbTransactionPageSchema = z.object({
  Data: z.array(UmbTransactionSchema),
  TotalPages: z.number().int().nonnegative(),
  Total: z.number().int().nonnegative(),
});
