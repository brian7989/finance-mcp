import type { ApiGetOptions, BenepassClient } from "../client.js";
import { PATHS } from "../constants.js";
import { parseItems } from "../parsing.js";
import { type Account, AccountSchema, type Balance } from "../schemas/accounts.js";

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

export async function listAccounts(
  api: BenepassClient,
  options: ApiGetOptions = {},
): Promise<Account[]> {
  const payload = await api.getJson(PATHS.accounts, options);
  return parseItems(AccountSchema, payload, "accounts");
}
