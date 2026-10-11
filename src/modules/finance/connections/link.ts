import * as z from "zod";
import { encryptCredential } from "../../../common/utils/encryption.js";
import { ownerSession } from "../../../config/env.js";
import {
  requireConnection,
  restoreConnection,
  saveConnection,
} from "../../../database/repositories/connections.js";
import { removeLink, requireValidLink, saveLink } from "../../../database/repositories/links.js";
import { createPlaidClient } from "../../integrations/plaid/client.js";
import { createHostedLink, exchangeHostedLink } from "../../integrations/plaid/link.js";
import { readPlaidCredential } from "../../integrations/plaid/provider.js";
import { canReconnect, resolveProvider } from "../../integrations/registry.js";
import type { FinanceContext } from "../context.js";
import type { Connection } from "../schemas.js";

export async function linkBenepass(context: FinanceContext): Promise<void> {
  if (!(await ownerSession(context.env).status()).logged_in) {
    throw new Error("Benepass is not signed in");
  }
  saveConnection(
    context.db,
    newConnection("benepass", "benepass", "Benepass", [
      "balances",
      "holdings",
    ]),
    null,
  );
}
export async function beginPlaidLink(
  context: FinanceContext,
  connectionId?: string,
): Promise<string> {
  validateLinkConfiguration(context);
  const flowId = crypto.randomUUID();
  const connection = connectionId ? requireConnection(context.db, connectionId) : undefined;
  const token = connection ? await readReconnectCredential(context, connection) : undefined;
  const link = await createHostedLink(createPlaidClient(context.env), context.env, flowId, token);
  saveLink(context.db, {
    id: flowId,
    token: link.link_token,
    connection_id: connectionId ?? null,
    expires_at: Date.parse(link.expiration),
  });
  return link.hosted_link_url;
}
export async function completePlaidLink(context: FinanceContext, flowId: string): Promise<void> {
  z.uuid().parse(flowId);
  const flow = requireValidLink(context.db, flowId);
  if (flow.connection_id) {
    await completeUpdateMode(context, flow.connection_id);
  } else {
    await saveNewPlaidConnection(context, flow.token);
  }
  removeLink(context.db, flowId);
}
async function completeUpdateMode(context: FinanceContext, id: string): Promise<void> {
  const previous = requireConnection(context.db, id);
  const provider = await resolveProvider(context, previous);
  await provider.readMetadata();
  restoreConnection(context.db, previous);
}
async function saveNewPlaidConnection(context: FinanceContext, linkToken: string): Promise<void> {
  const exchanged = await exchangeHostedLink(createPlaidClient(context.env), linkToken);
  const id = `plaid/${exchanged.item_id}`;
  const encrypted = await encryptCredential(context.env, id, exchanged.access_token);
  saveConnection(
    context.db,
    newConnection(id, "plaid", "Financial institution", [
      "balances",
    ]),
    encrypted,
  );
}
function newConnection(
  id: string,
  provider: Connection["provider"],
  institution: string,
  capabilities: Connection["capabilities"],
): Connection {
  return {
    id,
    provider,
    institution,
    capabilities,
    status: "connected",
    revision: crypto.randomUUID(),
    last_success_at: null,
    last_error: null,
  };
}

async function readReconnectCredential(
  context: FinanceContext,
  connection: Connection,
): Promise<string> {
  if (!canReconnect(connection)) {
    throw new Error("Connection does not support this reconnect flow");
  }
  return readPlaidCredential(context, connection);
}

function validateLinkConfiguration(context: FinanceContext): void {
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(context.env.DATA_KEY);
}
