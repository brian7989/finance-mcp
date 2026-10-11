import { escapeHtml, page } from "../auth/pages.js";
import type { OwnerSession } from "../auth/session.js";
import type { Account, Connection, Preference } from "../finance/schemas.js";

export function connectionsPage(
  owner: OwnerSession,
  connections: Connection[],
  accounts: Account[],
  preferences: Preference[],
  benepassEmail?: string,
): string {
  return page(
    "Your finances",
    `
    <h1>Your financial connections</h1>
    <p>Accounts are read-only. Daily balance observations and transaction history are saved on Cloudflare.</p>
    <form method="post" action="/connections/plaid/start">${csrfInput(owner)}
      <label>Account kind <select name="kind"><option value="bank">Banking and credit cards</option><option value="investment">Investments and retirement</option></select></label>
      <button>Connect through Plaid</button>
    </form>
    ${benepassLoginForm(owner, benepassEmail)}
    <h2>Connections</h2>${connections.map((connection) => connectionRow(owner, connection)).join("") || "<p>No connections yet.</p>"}
    <h2>Account preferences</h2><p>Exclude accounts used for someone else's finances from your personal totals.</p>
    ${accounts.map((account) => preferenceForm(owner, account, preferences)).join("")}
    <form method="post" action="/sign-out">${csrfInput(owner)}<button>Sign out of this browser</button></form>`,
  );
}
export function benepassCodePage(owner: OwnerSession): string {
  return page(
    "Benepass login code",
    `<h1>Check your email</h1>
    <form method="post" action="/connections/benepass/complete">${csrfInput(owner)}
      <label>Code <input name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
      <button>Connect Benepass</button>
    </form>`,
  );
}
export function signedOutPage(): string {
  return page(
    "Personal Finance MCP",
    "<h1>Personal Finance MCP</h1><p>Connect your financial accounts to your assistant.</p><a href='/sign-in'>Sign in</a>",
  );
}
function connectionRow(owner: OwnerSession, connection: Connection): string {
  const fields = `${csrfInput(owner)}<input type="hidden" name="connection_id" value="${escapeHtml(connection.id)}">`;
  return `<article><h3>${escapeHtml(connection.institution)}</h3><p>${escapeHtml(connection.status)}</p>
    <p>${escapeHtml(connection.last_error ?? "")}</p>
    <form method="post" action="/connections/sync">${fields}<button>Refresh saved data</button></form>
    ${reconnectForm(connection, fields)}
    <form method="post" action="/connections/disconnect">${fields}<button>Disconnect (keep history)</button></form></article>`;
}
function reconnectForm(connection: Connection, fields: string): string {
  if (connection.provider !== "plaid" || connection.status === "disconnected") {
    return "";
  }
  return `<form method="post" action="/connections/plaid/start">${fields}<input type="hidden" name="kind" value="bank"><button>Reconnect through Plaid</button></form>`;
}
function benepassLoginForm(owner: OwnerSession, email?: string): string {
  if (!email) {
    return "";
  }
  return `<form method="post" action="/connections/benepass/start">${csrfInput(owner)}
    <p>Benepass code will be sent to ${escapeHtml(email)}.</p>
    <label><input type="checkbox" name="registration" value="approved"> Create Benepass's email login identity if needed.</label>
    <button>Connect Benepass</button></form>`;
}
function preferenceForm(owner: OwnerSession, account: Account, preferences: Preference[]): string {
  const preference = preferences.find((value) => value.account_id === account.id);
  return `<form method="post" action="/accounts/preferences">${csrfInput(owner)}
    <input type="hidden" name="account_id" value="${escapeHtml(account.id)}">
    <p>${escapeHtml(account.name)} ${escapeHtml(account.mask ?? "")}</p>
    <label>Label <input name="label" maxlength="100" value="${escapeHtml(preference?.label ?? "")}"></label>
    <label><input type="checkbox" name="net_worth" ${preference?.include_in_net_worth === false ? "" : "checked"}> Include in net worth</label>
    <label><input type="checkbox" name="spending" ${preference?.include_in_spending === false ? "" : "checked"}> Include in spending reports</label>
    <button>Save preferences</button></form>`;
}
function csrfInput(owner: OwnerSession): string {
  return `<input type="hidden" name="csrf" value="${escapeHtml(owner.csrf)}">`;
}
