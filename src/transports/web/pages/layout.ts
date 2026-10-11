import { html } from "hono/html";

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
  headers.set("content-security-policy", contentSecurityPolicy(formOrigins));
  headers.set("x-frame-options", "DENY");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "same-origin");
  return new Response(rendered.toString(), {
    status,
    headers,
  });
}
export async function interactiveHtmlResponse(body: HtmlTemplate): Promise<Response> {
  const response = await htmlResponse(body);
  // Radix positions portals and locks body scrolling with element style attributes.
  response.headers.set(
    "content-security-policy",
    `${contentSecurityPolicy()}; script-src 'self'; style-src-attr 'unsafe-inline'`,
  );
  return response;
}
export function documentPage(title: string, body: HtmlTemplate): HtmlTemplate {
  return html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title><link rel="stylesheet" href="/assets/app.css"></head><body>${body}</body></html>`;
}
export function page(title: string, body: HtmlTemplate): HtmlTemplate {
  return documentPage(
    title,
    html`<div class="auth-shell"><header class="auth-brand"><span aria-hidden="true">◈</span> Personal Finance</header>
      <main class="auth-panel">${body}</main></div>`,
  );
}
function contentSecurityPolicy(formOrigins: string[] = []): string {
  const destinations = [
    "'self'",
    "https://secure.plaid.com",
    ...formOrigins.map((url) => new URL(url).origin),
  ];
  return `default-src 'none'; style-src 'self'; img-src 'self' data:; font-src 'self'; form-action ${destinations.join(" ")}; frame-ancestors 'none'; base-uri 'none'`;
}
