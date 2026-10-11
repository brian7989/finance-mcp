import { fixtureAccount, fixtureConnection } from "../../../../test/finance-fixtures.js";
import { connectionsPage } from "./connections.js";
import { htmlResponse } from "./layout.js";

describe("escaped financial templates", () => {
  it("escapes provider names and account labels while preserving composed forms", async () => {
    const owner = {
      subject: "fixture-owner",
      email: "owner@example.com",
      csrf: crypto.randomUUID(),
      flowId: crypto.randomUUID(),
    };
    const account = {
      ...fixtureAccount(),
      name: "<script>private()</script>",
    };
    const preference = {
      account_id: account.id,
      label: '" autofocus onfocus="private()',
      include_in_net_worth: false,
      include_in_spending: true,
    };
    const connection = {
      ...fixtureConnection(),
      institution: "<script>bank()</script>",
    };
    const response = await htmlResponse(
      connectionsPage(
        owner,
        [
          connection,
        ],
        [
          account,
        ],
        [
          preference,
        ],
      ),
    );
    expect(response.headers.get("referrer-policy")).toBe("same-origin");
    expect(response.headers.get("content-security-policy")).toContain(
      "form-action 'self' https://secure.plaid.com;",
    );
    const body = await response.text();
    const css = body.match(/<style>([\s\S]*?)<\/style>/)?.[1];
    expect(css).toBeDefined();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(css));
    const hash = btoa(String.fromCharCode(...new Uint8Array(digest)));
    expect(response.headers.get("content-security-policy")).toContain(`style-src 'sha256-${hash}'`);
    expect(response.headers.get("content-security-policy")).not.toContain("unsafe-inline");
    expect(body).not.toContain("<script>");
    expect(body).toContain("Connect institution");
    expect(body).not.toContain('name="kind"');
    expect(body).not.toContain("<select");
    expect(body).toContain("&lt;script&gt;");
    expect(body).not.toContain('value="" autofocus');
    expect(body).toContain('action="/connections/disconnect"');
    expect(body).toContain(`name="csrf" value="${owner.csrf}"`);
    expect(body).toContain('name="net_worth" >');
    expect(body).toContain('name="spending" checked>');
  });
});
