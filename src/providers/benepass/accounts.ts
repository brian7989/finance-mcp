import {
  type Account,
  AccountSchema,
  type Balance,
  type DerivedBenefit,
} from "./accounts.schemas.js";
import type { ApiGetOptions, BenepassClient } from "./client.js";
import { PATHS } from "./constants.js";
import { parseItems } from "./parsing.js";

const HSA_TYPE_VALUES = new Set([
  "hsa",
  "health_savings",
  "health_savings_account",
]);

function normalizeType(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Select HSA accounts from Zod-parsed fields only: enrollment.benefit.benefit_type,
 * enrollment.benefit.key, account.key, account.account_type, account.type.
 * Does not search account names.
 */
export function isHsaAccount(account: Account): boolean {
  return accountTypeFields(account).some(isHsaType);
}

function accountTypeFields(account: Account): (string | undefined)[] {
  return [
    account.enrollment?.benefit?.benefit_type,
    account.enrollment?.benefit?.key,
    account.key,
    account.account_type,
    account.type,
  ];
}

function isHsaType(value: string | undefined): boolean {
  return value !== undefined && HSA_TYPE_VALUES.has(normalizeType(value));
}

export function availableBalance(balances: Balance[] | undefined): Balance | undefined {
  const available = balances?.filter(isAvailableBalance) ?? [];
  return available.find(isPrimaryBalance) ?? available[0];
}

function isAvailableBalance(balance: Balance): boolean {
  return balance.key === "available" || balance.key.endsWith("/available");
}

function isPrimaryBalance(balance: Balance): boolean {
  return !balance.key.includes("reimbursement") && !balance.key.includes("payout");
}

export function deriveBenefits(accounts: Account[]): DerivedBenefit[] {
  const benefits: DerivedBenefit[] = [];
  for (const account of accounts) {
    const benefit = deriveBenefitFromAccount(account);
    if (benefit) {
      benefits.push(benefit);
    }
  }
  return benefits;
}

function deriveBenefitFromAccount(account: Account): DerivedBenefit | undefined {
  const benefit = account.enrollment?.benefit;
  if (!benefit) {
    return undefined;
  }
  const available = availableBalance(account.balances);
  return {
    id: benefit.id,
    name: benefit.name ?? null,
    benefit_type: benefit.benefit_type ?? null,
    account_id: account.id,
    available_balance: available?.amount ?? null,
    formatted_available_balance: available?.formatted_local_amount ?? null,
    max_per_expense: maxExpenseAmount(account),
  };
}

function maxExpenseAmount(account: Account): string | number | null {
  return (
    account.enrollment?.local_max_expense_amount ?? account.enrollment?.max_expense_amount ?? null
  );
}

export async function listAccounts(
  api: BenepassClient,
  options: ApiGetOptions = {},
): Promise<Account[]> {
  const payload = await api.getJson(PATHS.accounts, options);
  return parseItems(AccountSchema, payload, "accounts");
}

export async function listBenefits(
  api: BenepassClient,
  options: ApiGetOptions = {},
): Promise<{
  data: DerivedBenefit[];
}> {
  const accounts = await listAccounts(api, options);
  return {
    data: deriveBenefits(accounts),
  };
}
