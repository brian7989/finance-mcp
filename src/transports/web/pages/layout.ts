import { html, raw } from "hono/html";

import { styles } from "./styles.js";

export type HtmlTemplate = string | ReturnType<typeof html>;

export async function htmlResponse(
  body: HtmlTemplate,
  headers = new Headers(),
  status = 200,
  formOrigins: string[] = [],
): Promise<Response> {
  const rendered = await body;
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("content-security-policy", await contentSecurityPolicy(formOrigins));
  headers.set("x-frame-options", "DENY");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "same-origin");
  return new Response(rendered.toString(), {
    status,
    headers,
  });
}
export function page(title: string, body: HtmlTemplate): HtmlTemplate {
  return html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${raw(styles)}</style></head>
    <body><div class="shell">${brandHeader()}<main>${body}</main>${siteFooter()}</div></body></html>`;
}

async function contentSecurityPolicy(formOrigins: string[]): Promise<string> {
  const destinations = [
    "'self'",
    "https://secure.plaid.com",
    ...formOrigins.map((url) => new URL(url).origin),
  ];
  const styleHash = await stylesheetHash();
  return `style-src 'sha256-${styleHash}'; default-src 'none'; form-action ${destinations.join(" ")}; frame-ancestors 'none'; base-uri 'none'`;
}

async function stylesheetHash(): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(styles));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}
function brandHeader(): HtmlTemplate {
  return html`<header class="brand-bar"><div class="brand"><span class="brand-mark" aria-hidden="true">pf.</span>
    <div><span class="brand-name">Personal Finance</span><span class="brand-caption">Private connector</span></div></div>
    <span class="privacy">Read-only access</span></header>`;
}
function siteFooter(): HtmlTemplate {
  return html`<footer class="site-footer"><span>Personal Finance MCP</span><p>Balances, investments, and history. No transfers or trades.</p></footer>`;
}
