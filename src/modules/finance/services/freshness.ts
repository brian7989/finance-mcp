import type { Balance } from "../schemas.js";

const maximumAgeMs = 36 * 60 * 60 * 1000;

export function isStaleObservation(balance: Balance, now: number): boolean {
  const timestamp = Date.parse(balance.fetched_at);
  return !Number.isFinite(timestamp) || timestamp > now || now - timestamp > maximumAgeMs;
}
