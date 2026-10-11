import type { ConsentDescription } from "@cloudflare/workers-oauth-provider";

export function consentPage(details: ConsentDescription, handle: string): string {
  return page(
    "Connect your finances",
    `
    <h1>Allow ${escapeHtml(details.clientName)} to read your finances?</h1>
    <p>Access returns to <strong>${escapeHtml(details.redirectHost)}</strong>.</p>
    <p>Read connected accounts, balances, holdings, transactions, and saved history. No transfers or trades.</p>
    <form method="post" action="/authorize">
      <input type="hidden" name="handle" value="${escapeHtml(handle)}">
      <button name="decision" value="approve">Allow</button>
      <button name="decision" value="deny">Deny</button>
    </form>`,
  );
}
export function errorPage(): string {
  return page(
    "Request unsuccessful",
    "<h1>Request unsuccessful</h1><p>Sign in again or retry from the connections page.</p><a href='/connections'>Connections</a>",
  );
}
export function htmlResponse(body: string, headers = new Headers(), status = 200): Response {
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set(
    "content-security-policy",
    "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  );
  headers.set("x-frame-options", "DENY");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  return new Response(body, {
    status,
    headers,
  });
}
export function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body><main>${body}</main></body></html>`;
}
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}
