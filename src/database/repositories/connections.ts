import { and, eq, ne } from "drizzle-orm";
import { type Connection, ConnectionSchema } from "../../modules/finance/schemas.js";
import type { FinanceDatabase } from "../client.js";
import { connections } from "../schema.js";

export function listStoredConnections(db: FinanceDatabase): Connection[] {
  return db.select().from(connections).orderBy(connections.institution).all().map(parseConnection);
}
export function requireConnection(db: FinanceDatabase, id: string): Connection {
  const row = db.select().from(connections).where(eq(connections.id, id)).get();
  if (!row) {
    throw new Error("Unknown connection");
  }
  return parseConnection(row);
}
export function assertConnectionRevision(db: FinanceDatabase, expected: Connection): void {
  const current = requireConnection(db, expected.id);
  if (current.revision !== expected.revision || current.status === "disconnected") {
    throw new Error("Connection changed during operation");
  }
}
export function saveConnection(
  db: FinanceDatabase,
  connection: Connection,
  credential: string | null,
): void {
  const values = {
    ...connection,
    credential,
  };
  db.insert(connections)
    .values(values)
    .onConflictDoUpdate({
      target: connections.id,
      set: values,
    })
    .run();
}
export function hasStoredCredential(db: FinanceDatabase, id: string): boolean {
  return Boolean(
    db
      .select({
        credential: connections.credential,
      })
      .from(connections)
      .where(eq(connections.id, id))
      .get()?.credential,
  );
}
export function readEncryptedCredential(db: FinanceDatabase, id: string): string {
  const row = db
    .select({
      credential: connections.credential,
    })
    .from(connections)
    .where(eq(connections.id, id))
    .get();
  if (!row?.credential) {
    throw new Error("Connection is not linked");
  }
  return row.credential;
}
export function readSyncCursor(db: FinanceDatabase, id: string): string | null {
  return (
    db
      .select({
        cursor: connections.cursor,
      })
      .from(connections)
      .where(eq(connections.id, id))
      .get()?.cursor ?? null
  );
}
export function recordSuccess(db: FinanceDatabase, id: string): void {
  db.update(connections)
    .set({
      status: "connected",
      last_success_at: new Date().toISOString(),
      last_error: null,
    })
    .where(eq(connections.id, id))
    .run();
}
export function recordFailure(db: FinanceDatabase, expected: Connection, reconnect: boolean): void {
  const status = reconnect ? "needs_reconnection" : expected.status;
  const reason = reconnect
    ? "Sign in again to restore access."
    : "Provider unavailable; stored data may be stale.";
  db.update(connections)
    .set({
      status,
      last_error: reason,
    })
    .where(
      and(
        eq(connections.id, expected.id),
        eq(connections.revision, expected.revision),
        ne(connections.status, "disconnected"),
      ),
    )
    .run();
}
export function markDisconnected(db: FinanceDatabase, id: string): string {
  const revision = crypto.randomUUID();
  db.update(connections)
    .set({
      status: "disconnected",
      last_error: "Provider disconnection is pending. Retry disconnecting.",
      revision,
    })
    .where(eq(connections.id, id))
    .run();
  return revision;
}
export function clearCredential(db: FinanceDatabase, id: string, revision: string): void {
  db.update(connections)
    .set({
      credential: null,
      last_error: null,
    })
    .where(and(eq(connections.id, id), eq(connections.revision, revision)))
    .run();
}
export function updateConnectionMetadata(
  db: FinanceDatabase,
  expected: Connection,
  details: {
    institution: string;
    capabilities: Connection["capabilities"];
  },
): Connection {
  assertConnectionRevision(db, expected);
  db.update(connections).set(details).where(eq(connections.id, expected.id)).run();
  return {
    ...expected,
    ...details,
  };
}
function parseConnection(row: typeof connections.$inferSelect): Connection {
  return ConnectionSchema.parse(row);
}

export function restoreConnection(db: FinanceDatabase, expected: Connection): void {
  assertConnectionRevision(db, expected);
  db.update(connections)
    .set({
      status: "connected",
      revision: crypto.randomUUID(),
    })
    .where(and(eq(connections.id, expected.id), eq(connections.revision, expected.revision)))
    .run();
}
