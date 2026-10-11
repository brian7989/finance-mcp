import { html } from "hono/html";
import type { OwnerSession } from "../../../modules/auth/session.js";
import type { Account, Connection, Preference } from "../../../modules/finance/schemas.js";
import { canReconnect } from "../../../modules/integrations/registry.js";
import { type HtmlTemplate, page } from "./layout.js";

const capabilityLabels = {
  balances: "Balances",
  transactions: "Transactions",
  holdings: "Holdings",
  investment_activity: "Investment activity",
} satisfies Record<Connection["capabilities"][number], string>;

export function connectionsPage(
  owner: OwnerSession,
  connections: Connection[],
  accounts: Account[],
  preferences: Preference[],
  benepassEmail?: string,
): HtmlTemplate {
  return page(
    "Your financial connections",
    html`${pageHeading(connections, accounts)}
      ${addInstitutionPanel(owner, connections, benepassEmail)}
      ${connectionsSection(owner, connections, accounts)}
      ${accountsSection(owner, connections, accounts, preferences)}
      ${signOutForm(owner)}`,
  );
}
export function benepassCodePage(owner: OwnerSession): HtmlTemplate {
  return page(
    "Benepass login code",
    html`<section class="auth-panel"><p class="eyebrow">Connect Benepass</p>
      <h1>Check your email</h1><p>Enter your six-digit code to securely connect your HSA.</p>
      <form method="post" action="/connections/benepass/complete">${csrfInput(owner)}
        <label class="field">Login code <input name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
        <button>Connect Benepass</button>
      </form></section>`,
  );
}
export function signedOutPage(): HtmlTemplate {
  return page(
    "Personal Finance MCP",
    html`<section class="auth-panel"><p class="eyebrow">Your private connector</p>
      <h1>Your finances, connected.</h1><p>Connect your financial accounts to your assistant. View balances, investments, and saved history in one place.</p>
      <a class="button" href='/sign-in'>Sign in</a></section>`,
  );
}
function pageHeading(connections: Connection[], accounts: Account[]): HtmlTemplate {
  const connected = connections.filter((connection) => connection.status === "connected").length;
  const active = accounts.filter((account) => account.active).length;
  return html`<header class="page-heading"><p class="eyebrow">Account management</p>
    <h1>Financial connections</h1>
    <p class="intro">A clear view of what your assistant can access. Connect an institution, check its status, and choose which accounts count toward your totals.</p>
    <div class="overview"><span><strong>${connected}</strong> ${plural(connected, "institution")} connected</span>
      <span class="separator" aria-hidden="true">/</span><span><strong>${active}</strong> active ${plural(active, "account")}</span>
      <span class="separator" aria-hidden="true">/</span><span>Daily balance snapshots</span></div>
  </header>`;
}
function addInstitutionPanel(
  owner: OwnerSession,
  connections: Connection[],
  email?: string,
): HtmlTemplate {
  return html`<details class="add-panel" ${connections.length === 0 ? "open" : ""}>
    <summary>Add institution</summary><div class="add-options">
      ${plaidLoginForm(owner)}${benepassLoginForm(owner, email)}
    </div></details>`;
}
function plaidLoginForm(owner: OwnerSession): HtmlTemplate {
  return html`<form class="add-option" method="post" action="/connections/plaid/start">${csrfInput(owner)}
    <div><h3>Banks &amp; investments</h3><p>Connect your institution through Plaid. Share the accounts you choose, including banking, credit cards, investments, and retirement.</p></div>
    <button>Connect institution</button></form>`;
}
function benepassLoginForm(owner: OwnerSession, email?: string): HtmlTemplate {
  if (!email) {
    return "";
  }
  return html`<form class="add-option" method="post" action="/connections/benepass/start">${csrfInput(owner)}
    <div><h3>Benepass HSA</h3><p>Connect your HSA cash and investments. A login code will be sent to ${email}.</p></div>
    <label class="check"><input type="checkbox" name="registration" value="approved"> Create Benepass's email login identity if needed.</label>
    <button class="secondary">Connect Benepass</button></form>`;
}
function connectionsSection(
  owner: OwnerSession,
  connections: Connection[],
  accounts: Account[],
): HtmlTemplate {
  return html`<section aria-labelledby="connections-heading">
    ${sectionHeading("connections-heading", "Institutions", connections.length)}
    ${connectionCards(owner, connections, accounts)}
  </section>`;
}
function connectionCards(
  owner: OwnerSession,
  connections: Connection[],
  accounts: Account[],
): HtmlTemplate {
  if (connections.length === 0) {
    return emptyState(
      "A fresh start",
      "Add your first institution to bring your accounts together.",
    );
  }
  return html`<div class="connection-grid">${connections.map((connection) => connectionCard(owner, connection, accounts))}</div>`;
}
function connectionCard(
  owner: OwnerSession,
  connection: Connection,
  accounts: Account[],
): HtmlTemplate {
  const count = accounts.filter(
    (account) => account.connection_id === connection.id && account.active,
  ).length;
  return html`<article class="connection-card">
    <div class="connection-heading"><span class="institution-mark" aria-hidden="true">${connection.institution.slice(0, 1).toUpperCase()}</span>
      <div class="institution-name"><h3>${connection.institution}</h3><p>${count} ${plural(count, "account")} linked</p></div>
      ${statusBadge(connection)}
    </div>
    ${capabilityTags(connection)}${syncInformation(connection)}
    ${connectionNotice(connection)}${connectionActions(owner, connection)}
  </article>`;
}
function statusBadge(connection: Connection): HtmlTemplate {
  if (connection.status === "disconnected") {
    return html`<span class="status inactive">Disconnected</span>`;
  }
  if (connection.status === "needs_reconnection") {
    return html`<span class="status warning">Reconnect</span>`;
  }
  if (connection.last_error) {
    return html`<span class="status warning">Needs attention</span>`;
  }
  return html`<span class="status">Connected</span>`;
}
function capabilityTags(connection: Connection): HtmlTemplate {
  return html`<div class="capabilities" aria-label="Available data">${connection.capabilities.map((capability) => html`<span class="capability">${capabilityLabels[capability]}</span>`)}</div>`;
}
function syncInformation(connection: Connection): HtmlTemplate {
  if (!connection.last_success_at) {
    return html`<div class="sync"><span>Last synced</span><span>Awaiting first sync</span></div>`;
  }
  return html`<div class="sync"><span>Last synced</span><time datetime="${connection.last_success_at}">${formatSyncTime(connection.last_success_at)}</time></div>`;
}
function formatSyncTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}
function connectionNotice(connection: Connection): HtmlTemplate {
  if (!connection.last_error) {
    return "";
  }
  return html`<p class="notice" role="status">${connection.last_error}</p>`;
}
function connectionActions(owner: OwnerSession, connection: Connection): HtmlTemplate {
  const fields = connectionFields(owner, connection);
  return html`<details class="connection-actions"><summary>Manage connection</summary>
    <div class="action-list">${refreshForm(connection, fields)}${reconnectForm(connection, fields)}
      <form method="post" action="/connections/disconnect">${fields}<button class="danger">Disconnect · keep history</button></form>
    </div></details>`;
}
function refreshForm(connection: Connection, fields: HtmlTemplate): HtmlTemplate {
  if (connection.status === "disconnected") {
    return "";
  }
  return html`<form method="post" action="/connections/sync">${fields}<button class="secondary">Refresh saved data</button></form>`;
}
function reconnectForm(connection: Connection, fields: HtmlTemplate): HtmlTemplate {
  if (!canReconnect(connection)) {
    return "";
  }
  return html`<form method="post" action="/connections/plaid/start">${fields}<button class="secondary">Reconnect through Plaid</button></form>`;
}
function connectionFields(owner: OwnerSession, connection: Connection): HtmlTemplate {
  return html`${csrfInput(owner)}<input type="hidden" name="connection_id" value="${connection.id}">`;
}
function accountsSection(
  owner: OwnerSession,
  connections: Connection[],
  accounts: Account[],
  preferences: Preference[],
): HtmlTemplate {
  return html`<section class="account-section" aria-labelledby="accounts-heading">
    ${sectionHeading("accounts-heading", "Account preferences", accounts.length)}
    <p class="section-intro">Rename accounts or exclude them from your personal totals and spending reports.</p>
    ${accountPreferences(owner, connections, accounts, preferences)}
  </section>`;
}
function accountPreferences(
  owner: OwnerSession,
  connections: Connection[],
  accounts: Account[],
  preferences: Preference[],
): HtmlTemplate {
  if (accounts.length === 0) {
    return emptyState(
      "No accounts yet",
      "Your accounts will appear here after the first successful sync.",
    );
  }
  return html`<div class="account-list">${accounts.map((account) => accountDisclosure(owner, account, connections, preferences))}</div>`;
}
function accountDisclosure(
  owner: OwnerSession,
  account: Account,
  connections: Connection[],
  preferences: Preference[],
): HtmlTemplate {
  const preference = preferences.find((value) => value.account_id === account.id);
  const institution =
    connections.find((value) => value.id === account.connection_id)?.institution ??
    "Financial institution";
  return html`<details class="account"><summary><span class="account-title">
    <span class="account-name">${preference?.label || account.name}</span>
    <span class="account-meta">${institution} · ${account.subtype ?? account.type}${account.active ? "" : " · Inactive"}</span></span>
    <span class="account-mask">${account.mask ? html`••${account.mask}` : ""}</span>
  </summary>${preferenceForm(owner, account, preference)}</details>`;
}
function preferenceForm(
  owner: OwnerSession,
  account: Account,
  preference?: Preference,
): HtmlTemplate {
  return html`<form class="preference-form" method="post" action="/accounts/preferences">${csrfInput(owner)}
    <input type="hidden" name="account_id" value="${account.id}">
    <label class="field">Display name <input name="label" maxlength="100" placeholder="${account.name}" value="${preference?.label ?? ""}"></label>
    <div class="preference-checks">
      <label class="check"><input type="checkbox" name="net_worth" ${preference?.include_in_net_worth === false ? "" : "checked"}> Include in net worth</label>
      <label class="check"><input type="checkbox" name="spending" ${preference?.include_in_spending === false ? "" : "checked"}> Include in spending reports</label>
    </div><button class="secondary">Save preferences</button></form>`;
}
function sectionHeading(id: string, title: string, count: number): HtmlTemplate {
  return html`<div class="section-heading"><h2 id="${id}">${title}</h2><span class="count">${count}</span></div>`;
}
function emptyState(title: string, description: string): HtmlTemplate {
  return html`<div class="empty"><strong>${title}</strong><p>${description}</p></div>`;
}
function signOutForm(owner: OwnerSession): HtmlTemplate {
  return html`<form method="post" action="/sign-out">${csrfInput(owner)}<button class="quiet">Sign out of this browser</button></form>`;
}
function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}
function csrfInput(owner: OwnerSession): HtmlTemplate {
  return html`<input type="hidden" name="csrf" value="${owner.csrf}">`;
}
