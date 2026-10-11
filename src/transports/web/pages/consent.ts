import type { ConsentDescription } from "@cloudflare/workers-oauth-provider";
import { html } from "hono/html";
import { type HtmlTemplate, page } from "./layout.js";

export function consentPage(details: ConsentDescription, handle: string): HtmlTemplate {
  return page(
    "Connect your finances",
    html`
    <h1>Allow ${details.clientName} to read your finances?</h1>
    <p>Access returns to <strong>${details.redirectHost}</strong>.</p>
    <p>Read connected accounts, balances, holdings, transactions, and saved history. No transfers or trades.</p>
    <form method="post" action="/authorize">
      <input type="hidden" name="handle" value="${handle}">
      <button name="decision" value="approve">Allow</button>
      <button name="decision" value="deny">Deny</button>
    </form>`,
  );
}
export function errorPage(): HtmlTemplate {
  return page(
    "Request unsuccessful",
    html`<h1>Request unsuccessful</h1><p>Sign in again or retry from the connections page.</p><a href='/connections'>Connections</a>`,
  );
}
