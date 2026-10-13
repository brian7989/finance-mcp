import * as z from "zod";
import { decryptCredential, encryptCredential } from "../../../common/utils/encryption.js";
import { saveConnection } from "../../../database/repositories/connections.js";
import { removeLink, requireValidLink, saveLink } from "../../../database/repositories/links.js";
import {
  beginUmbLogin,
  completeUmbCode,
  sendUmbCode,
  UmbLoginStateSchema,
  type UmbMethod,
} from "../../integrations/umb/auth.js";
import type { FinanceContext } from "../context.js";

const PendingSchema = z.object({
  state: UmbLoginStateSchema,
  methods: z.array(
    z.object({
      method: z.enum([
        "email",
        "sms",
        "phone",
      ]),
      label: z.string(),
    }),
  ),
});
export async function beginUmbConnection(
  context: FinanceContext,
  ownerFlow: string,
  input: unknown,
): Promise<UmbMethod[]> {
  const result = await beginUmbLogin(input);
  if (!result.methods.length) {
    await saveUmbConnection(context, result.state.cookies);
    return [];
  }
  await savePending(context, ownerFlow, result);
  return result.methods;
}
export async function requestUmbCode(
  context: FinanceContext,
  ownerFlow: string,
  method: string,
): Promise<void> {
  const pending = await readPending(context, ownerFlow);
  const selected = pending.methods.find((option) => option.method === method);
  if (!selected) {
    throw new Error("Unsupported UMB verification method");
  }
  pending.state = await sendUmbCode(pending.state, selected.method);
  await savePending(context, ownerFlow, pending);
}
export async function finishUmbConnection(
  context: FinanceContext,
  ownerFlow: string,
  code: string,
): Promise<void> {
  const id = pendingId(ownerFlow);
  const original = requireValidLink(context.db, id).token;
  const pending = await readPending(context, ownerFlow);
  const cookies = await completeUmbCode(pending.state, code);
  if (requireValidLink(context.db, id).token !== original) {
    throw new Error("UMB login was replaced");
  }
  await saveUmbConnection(context, cookies);
  removeLink(context.db, id);
}
async function saveUmbConnection(context: FinanceContext, cookies: string): Promise<void> {
  const credential = await encryptCredential(context.env, "umb", cookies);
  saveConnection(
    context.db,
    {
      id: "umb",
      provider: "umb",
      institution: "UMB HSA",
      status: "connected",
      capabilities: [
        "balances",
        "transactions",
      ],
      revision: crypto.randomUUID(),
      last_success_at: null,
      last_error: null,
    },
    credential,
  );
}
async function readPending(context: FinanceContext, ownerFlow: string) {
  const id = pendingId(ownerFlow);
  const flow = requireValidLink(context.db, id);
  return PendingSchema.parse(JSON.parse(await decryptCredential(context.env, id, flow.token)));
}
async function savePending(
  context: FinanceContext,
  ownerFlow: string,
  pending: z.infer<typeof PendingSchema>,
): Promise<void> {
  const id = pendingId(ownerFlow);
  const token = await encryptCredential(context.env, id, JSON.stringify(pending));
  context.storage.transactionSync(() => {
    removeLink(context.db, id);
    saveLink(context.db, {
      id,
      token,
      connection_id: null,
      expires_at: Date.now() + 10 * 60_000,
    });
  });
}
function pendingId(ownerFlow: string): string {
  return `umb/${z.uuid().parse(ownerFlow)}`;
}
