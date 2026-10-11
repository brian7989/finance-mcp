import { fixtureAccount, fixtureConnection } from "../../../../test/finance-fixtures.js";
import { connectionsPage } from "./connections.js";
import { htmlResponse, interactiveHtmlResponse } from "./layout.js";

const owner = {
  subject: "fixture-owner",
  email: "owner@example.com",
  csrf: crypto.randomUUID(),
  flowId: crypto.randomUUID(),
};

describe("owner-only React page shell", () => {
  it("preserves hostile labels as inert JSON and omits archived accounts and provider IDs", async () => {
    const account = {
      ...fixtureAccount(),
      name: "</script><script>private()</script>",
      mask: null,
    };
    const connection = {
      ...fixtureConnection(),
      institution: "<script>bank()</script>",
    };
    const preference = {
      account_id: account.id,
      label: '" autofocus onfocus="private()',
      include_in_net_worth: false,
      include_in_spending: true,
    };
    const response = await interactiveHtmlResponse(
      connectionsPage(
        owner,
        [
          connection,
        ],
        [
          account,
          {
            ...fixtureAccount("archived-fixture"),
            name: "Archived fixture",
            active: false,
          },
        ],
        [
          preference,
          {
            ...preference,
            account_id: "archived-fixture",
          },
        ],
      ),
    );
    const body = await response.text();
    const json = body.match(
      /<script id="connections-data" type="application\/json">([\s\S]*?)<\/script>/,
    )?.[1];
    expect(json).toBeDefined();
    const data = JSON.parse(json ?? "{}");
    expect(data.accounts).toHaveLength(1);
    expect(data.accounts[0]).toMatchObject({
      name: account.name,
      mask: null,
    });
    expect(data.preferences).toEqual([
      preference,
    ]);
    expect(data.connections[0].institution).toBe(connection.institution);
    expect(data.csrf).toBe(owner.csrf);
    expect(body).not.toContain("<script>private()");
    expect(body).not.toContain("Archived fixture");
    expect(body).not.toContain("provider_account_id");
    expect(body).not.toContain("revision");
    expect(body).not.toContain(owner.email);
    expect(body).toContain('src="/assets/app.js"');
    expect(body).toContain('href="/assets/app.css"');
  });
  it("allows only same-origin scripts and style attributes needed by Radix", async () => {
    const response = await interactiveHtmlResponse(connectionsPage(owner, [], [], []));
    const policy = response.headers.get("content-security-policy");
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("style-src 'self'");
    expect(policy).toContain("style-src-attr 'unsafe-inline'");
    expect(policy).not.toContain("script-src 'unsafe-inline'");
    expect(policy).toContain("form-action 'self' https://secure.plaid.com;");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("same-origin");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("keeps sign-in and consent pages free of executable scripts", async () => {
    const response = await htmlResponse("Static consent");
    expect(response.headers.get("content-security-policy")).not.toContain("script-src");
    expect(response.headers.get("content-security-policy")).not.toContain("unsafe-inline");
  });
});
