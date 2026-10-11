import type { Next } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Configuration } from "../../config/env.js";
import { assertSameOrigin } from "../../modules/auth/origin.js";
import { assertOwnerCsrf, requireOwnerSession } from "../../modules/auth/session.js";
import { type WebContext, webFactory } from "./context.js";

export function applyConfiguration(configuration: Configuration) {
  return webFactory.createMiddleware(async function configureRequest(context, next) {
    context.set("configuration", configuration);
    await next();
  });
}
export async function requireOwner(context: WebContext, next: Next): Promise<void> {
  const owner = await requireOwnerSession(context.req.raw, context.var.configuration);
  context.set("owner", owner);
  await next();
}
export async function limitFormBody(context: WebContext, next: Next): Promise<void> {
  // Always measure the stream, including requests with an incorrect Content-Length.
  const headers = new Headers(context.req.raw.headers);
  headers.delete("content-length");
  context.req.raw = new Request(context.req.raw, {
    headers,
  });
  await bodyLimit({
    maxSize: 8192,
  })(context, next);
}
export async function readForm(context: WebContext, next: Next): Promise<void> {
  assertSameOrigin(context.req.raw, context.var.configuration);
  assertFormEncoding(context);
  context.set(
    "form",
    new URLSearchParams(new TextDecoder().decode(await context.req.arrayBuffer())),
  );
  await next();
}
export async function verifyOwnerForm(context: WebContext, next: Next): Promise<void> {
  assertOwnerCsrf(context.var.form, context.var.owner);
  await next();
}
export async function rejectHeadRequests(
  context: WebContext,
  next: Next,
): Promise<Response | undefined> {
  if (context.req.raw.method === "HEAD") {
    return new Response(null, {
      status: 405,
    });
  }
  await next();
  return undefined;
}
function assertFormEncoding(context: WebContext): void {
  const type = context.req.header("content-type");
  if (type?.split(";")[0]?.trim().toLowerCase() !== "application/x-www-form-urlencoded") {
    throw new Error("Invalid form encoding");
  }
}
