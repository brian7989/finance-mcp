import type { Env } from "../config.js";
import { ownerStore } from "../config.js";
import { isStaleObservation } from "./freshness.js";
import { calculateNetWorth } from "./net-worth.js";
import type { Account, Balance, Connection, Preference } from "./schemas.js";

export async function getNetWorth(env: Env) {
  return ownerStore(env).netWorth();
}
export function summarizeNetWorth(
  accounts: Account[],
  balances: Balance[],
  preferences: Preference[],
  connections: Connection[],
  now = Date.now(),
) {
  const selected = includedAccounts(accounts, preferences);
  const observations = balances.filter((balance) =>
    selected.some((account) => account.id === balance.account_id),
  );
  const result = calculateNetWorth(selected, observations, []);
  const relevant = connections.filter((connection) =>
    selected.some((account) => account.connection_id === connection.id),
  );
  const unavailable = relevant.filter(isConnectionUnavailable);
  const stale = observations.filter((balance) => isStaleObservation(balance, now));
  return {
    ...result,
    complete: result.complete && unavailable.length === 0 && selected.length > 0,
    observations_fresh:
      selected.length > 0 && stale.length === 0 && unavailable.length === 0 && result.complete,
    stale_account_ids: stale.map((balance) => balance.account_id),
    unavailable_connection_ids: unavailable.map((connection) => connection.id),
    fetched_at: new Date(now).toISOString(),
    balance_observations: observations,
  };
}
function includedAccounts(accounts: Account[], preferences: Preference[]): Account[] {
  return accounts.filter(
    (account) =>
      account.active &&
      preferences.find((preference) => preference.account_id === account.id)
        ?.include_in_net_worth !== false,
  );
}
function isConnectionUnavailable(connection: Connection): boolean {
  return (
    connection.status !== "connected" ||
    connection.last_error !== null ||
    connection.last_success_at === null
  );
}
