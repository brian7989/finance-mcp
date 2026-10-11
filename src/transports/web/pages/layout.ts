import { html } from "hono/html";

export type HtmlTemplate = string | ReturnType<typeof html>;

export async function htmlResponse(
  body: HtmlTemplate,
  headers = new Headers(),
  status = 200,
): Promise<Response> {
  const rendered = await body;
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set(
    "content-security-policy",
    "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  );
  headers.set("x-frame-options", "DENY");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  return new Response(rendered.toString(), {
    status,
    headers,
  });
}
export function page(title: string, body: HtmlTemplate): HtmlTemplate {
  return html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body><main>${body}</main></body></html>`;
}
