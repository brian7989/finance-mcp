import type { Env } from "../config.js";
import { ownerStore } from "../config.js";
import { calculateNetWorth } from "./net-worth.js";

export async function getNetWorth(env: Env) {
  const store = ownerStore(env);
  const accounts = await store.accounts();
  const balances = await store.balances();
  const result = calculateNetWorth(accounts.accounts, balances.balances, accounts.preferences);
  const unavailable = accounts.connections.filter(
    (connection) =>
      connection.status !== "connected" ||
      connection.last_error !== null ||
      connection.last_success_at === null,
  );
  return {
    ...result,
    complete: result.complete && unavailable.length === 0 && accounts.connections.length > 0,
    unavailable_connection_ids: unavailable.map((connection) => connection.id),
    fetched_at: new Date().toISOString(),
    balance_observations: balances.balances,
  };
}
