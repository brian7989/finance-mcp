import type { OwnerSession } from "../../modules/auth/session.js";
import type { Account, Connection, Preference } from "../../modules/finance/schemas.js";
import { canReconnect } from "../../modules/integrations/registry.js";

import type { AccountView, ConnectionsData, ConnectionView } from "./connections-types.js";

export function connectionsData(
  owner: OwnerSession,
  connections: Connection[],
  accounts: Account[],
  preferences: Preference[],
  benepassEmail?: string,
): ConnectionsData {
  const activeAccounts = accounts.filter((account) => account.active);
  const activeIds = new Set(activeAccounts.map((account) => account.id));
  return {
    csrf: owner.csrf,
    connections: connections.map(connectionView),
    accounts: activeAccounts.map(accountView),
    preferences: preferences.filter((preference) => activeIds.has(preference.account_id)),
    benepassEmail: benepassEmail ?? null,
  };
}
function connectionView(connection: Connection): ConnectionView {
  return {
    id: connection.id,
    institution: connection.institution,
    status: connection.status,
    capabilities: connection.capabilities,
    last_success_at: connection.last_success_at,
    last_error: connection.last_error,
    canReconnect: canReconnect(connection),
  };
}
function accountView(account: Account): AccountView {
  return {
    id: account.id,
    connection_id: account.connection_id,
    name: account.name,
    mask: account.mask,
    type: account.type,
    subtype: account.subtype,
  };
}
