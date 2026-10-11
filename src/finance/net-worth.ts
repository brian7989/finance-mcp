import { addAmounts, negateAmount } from "./money.js";
import type { Account, Balance, Preference } from "./schemas.js";

export function calculateNetWorth(
  accounts: Account[],
  balances: Balance[],
  preferences: Preference[],
) {
  const totals = new Map<string, string>();
  const missing: string[] = [];
  for (const account of accounts) {
    if (!shouldCountAccount(account, preferences)) {
      continue;
    }
    const balance = balances.find((value) => value.account_id === account.id);
    if (
      !balance ||
      balance.current === null ||
      !balance.currency ||
      balance.completeness !== "complete"
    ) {
      missing.push(account.id);
      continue;
    }
    const amount = netWorthAmount(account, balance.current);
    totals.set(balance.currency, addAmounts(totals.get(balance.currency) ?? "0", amount));
  }
  return {
    totals: Array.from(totals, ([currency, amount]) => ({
      currency,
      amount,
    })),
    missing_account_ids: missing,
    complete: missing.length === 0,
  };
}
function shouldCountAccount(account: Account, preferences: Preference[]): boolean {
  const preference = preferences.find((value) => value.account_id === account.id);
  return account.active && (preference?.include_in_net_worth ?? true);
}
function netWorthAmount(account: Account, amount: string): string {
  if (account.type === "credit" || account.type === "loan") {
    return negateAmount(amount);
  }
  return amount;
}
