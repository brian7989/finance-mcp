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
    const body = await response.text();
    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;");
    expect(body).not.toContain('value="" autofocus');
    expect(body).toContain('action="/connections/disconnect"');
    expect(body).toContain(`name="csrf" value="${owner.csrf}"`);
    expect(body).toContain('name="net_worth" >');
    expect(body).toContain('name="spending" checked>');
  });
});
