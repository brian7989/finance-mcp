import { html, raw } from "hono/html";
import type { OwnerSession } from "../../../modules/auth/session.js";
import type { Account, Connection, Preference } from "../../../modules/finance/schemas.js";
import { connectionsData } from "../connections-data.js";
import { documentPage, type HtmlTemplate, page } from "./layout.js";

export function connectionsPage(
  owner: OwnerSession,
  connections: Connection[],
  accounts: Account[],
  preferences: Preference[],
  benepassEmail?: string,
): HtmlTemplate {
  const data = connectionsData(owner, connections, accounts, preferences, benepassEmail);
  return documentPage(
    "Your connections · Personal Finance",
    html`<div id="app"><p class="loading-message" role="status">Loading your connections…</p></div>
      <noscript><p class="loading-message">Enable JavaScript to manage your connections.</p></noscript>
      <script id="connections-data" type="application/json">${raw(serializeData(data))}</script>
      <script type="module" src="/assets/app.js"></script>`,
  );
}
export function benepassCodePage(owner: OwnerSession): HtmlTemplate {
  return page(
    "Benepass login code",
    html`<p class="eyebrow">Connect Benepass</p><h1>Check your email</h1>
      <p>Enter your six-digit code to securely connect your HSA.</p>
      <form method="post" action="/connections/benepass/complete">
        <input type="hidden" name="csrf" value="${owner.csrf}">
        <label class="field">Login code <input name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
        <button>Connect Benepass</button>
      </form>`,
  );
}
export function signedOutPage(): HtmlTemplate {
  return page(
    "Personal Finance",
    html`<p class="eyebrow">Your private workspace</p><h1>Your finances, connected.</h1>
      <p>Give your assistant a clear view of your accounts, investments, and history.</p>
      <a class="button" href="/sign-in">Sign in</a>`,
  );
}
function serializeData(data: unknown): string {
  // JSON is inert, but HTML parsers still recognize closing script tags inside it.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
