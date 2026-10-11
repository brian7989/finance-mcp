import { type Connection, ConnectionSchema } from "../finance/schemas.js";

type ConnectionRow = {
  id: string;
  provider: string;
  institution: string;
  status: string;
  capabilities: string;
  revision: string;
  last_success_at: string | null;
  last_error: string | null;
};
const publicColumns =
  "id, provider, institution, status, capabilities, revision, last_success_at, last_error";

export function listStoredConnections(sql: SqlStorage): Connection[] {
  return sql
    .exec<ConnectionRow>(`SELECT ${publicColumns} FROM connections ORDER BY institution`)
    .toArray()
    .map(parseConnection);
}
export function requireConnection(sql: SqlStorage, id: string): Connection {
  const row = sql
    .exec<ConnectionRow>(`SELECT ${publicColumns} FROM connections WHERE id = ?`, id)
    .toArray()[0];
  if (!row) {
    throw new Error("Unknown connection");
  }
  return parseConnection(row);
}
export function assertConnectionRevision(sql: SqlStorage, expected: Connection): void {
  const current = requireConnection(sql, expected.id);
  if (current.revision !== expected.revision || current.status === "disconnected") {
    throw new Error("Connection changed during operation");
  }
}
export function saveConnection(
  sql: SqlStorage,
  connection: Connection,
  credential: string | null,
): void {
  sql.exec(
    `INSERT INTO connections (id, provider, institution, status, capabilities, credential, revision)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status = excluded.status, capabilities = excluded.capabilities,
      credential = excluded.credential, revision = excluded.revision, institution = excluded.institution, last_error = NULL`,
    connection.id,
    connection.provider,
    connection.institution,
    connection.status,
    JSON.stringify(connection.capabilities),
    credential,
    connection.revision,
  );
}
export function readEncryptedCredential(sql: SqlStorage, id: string): string {
  const row = sql
    .exec<{
      credential: string | null;
    }>("SELECT credential FROM connections WHERE id = ?", id)
    .toArray()[0];
  if (!row?.credential) {
    throw new Error("Connection is not linked");
  }
  return row.credential;
}
export function readSyncCursor(sql: SqlStorage, id: string): string | null {
  return (
    sql
      .exec<{
        cursor: string | null;
      }>("SELECT cursor FROM connections WHERE id = ?", id)
      .toArray()[0]?.cursor ?? null
  );
}
export function recordSuccess(sql: SqlStorage, id: string): void {
  sql.exec(
    "UPDATE connections SET status = 'connected', last_success_at = ?, last_error = NULL WHERE id = ?",
    new Date().toISOString(),
    id,
  );
}
export function recordFailure(sql: SqlStorage, expected: Connection, reconnect: boolean): void {
  const status = reconnect ? "needs_reconnection" : expected.status;
  const reason = reconnect
    ? "Sign in again to restore access."
    : "Provider unavailable; stored data may be stale.";
  sql.exec(
    "UPDATE connections SET status = ?, last_error = ? WHERE id = ? AND revision = ? AND status != 'disconnected'",
    status,
    reason,
    expected.id,
    expected.revision,
  );
}
function parseConnection(row: ConnectionRow): Connection {
  return ConnectionSchema.parse({
    ...row,
    capabilities: JSON.parse(row.capabilities),
  });
}
