import type { AccountView, ConnectionsData, ConnectionView } from "../../connections-types";

export function accountLabel(account: AccountView, data: ConnectionsData): string {
  return (
    data.preferences.find((preference) => preference.account_id === account.id)?.label ||
    account.name
  );
}
export function accountType(account: AccountView): string {
  const label = account.subtype ?? account.type;
  return label
    .replaceAll("_", " ")
    .replace(/\bhsa\b/gi, "HSA")
    .replace(/\b\w/, (letter) => letter.toUpperCase());
}
export function accountSuffix(account: AccountView): string {
  return account.mask ? `••${account.mask}` : "Number unavailable";
}
export function connectionAccounts(
  connection: ConnectionView,
  data: ConnectionsData,
): AccountView[] {
  return data.accounts.filter((account) => account.connection_id === connection.id);
}
export function syncTime(value: string | null): string {
  if (!value) {
    return "Awaiting first sync";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  }).format(new Date(value));
}
export function connectionStatus(connection: ConnectionView): string {
  if (connection.status === "disconnected") {
    return "Disconnected";
  }
  if (connection.status === "needs_reconnection") {
    return "Reconnect";
  }
  if (connection.last_error) {
    return "Needs attention";
  }
  return "Connected";
}
export function requiresAttention(connection: ConnectionView): boolean {
  return connection.status === "needs_reconnection" || Boolean(connection.last_error);
}
export function accountCount(count: number): string {
  return `${count} ${count === 1 ? "account" : "accounts"}`;
}
