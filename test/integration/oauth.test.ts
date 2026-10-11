import { exports } from "cloudflare:workers";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { base64url, exportJWK, generateKeyPair, SignJWT } from "jose";

const origin = "https://mcp.example.com";
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("real Workers OAuth and MCP transport", {
  timeout: 15000,
}, () => {
  it("rejects unauthenticated access and publishes discovery", async () => {
    const response = await workerFetch(`${origin}/mcp`, {
      method: "POST",
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("oauth-protected-resource");
    const metadata = await workerFetch(`${origin}/.well-known/oauth-protected-resource/mcp`);
    expect(await metadata.json()).toMatchObject({
      resource: `${origin}/mcp`,
      authorization_servers: [
        origin,
      ],
    });
  });
  it("runs consent, Access sign-in, token exchange and MCP calls", async () => {
    const keys = await generateKeyPair("RS256");
    const jwk = {
      ...(await exportJWK(keys.publicKey)),
      kid: "test-key",
      alg: "RS256",
      use: "sig",
    };
    let nonce = "";
    const clientId = "https://client.example/client.json";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        if (url.href === clientId) {
          return Response.json({
            client_id: clientId,
            client_name: "Test assistant",
            redirect_uris: [
              "https://client.example/callback",
            ],
            token_endpoint_auth_method: "none",
          });
        }
        if (url.pathname === "/.well-known/openid-configuration") {
          return Response.json({
            issuer: "https://identity.example.com",
            authorization_endpoint: "https://identity.example.com/authorize",
            token_endpoint: "https://identity.example.com/token",
            jwks_uri: "https://identity.example.com/keys",
          });
        }
        if (url.pathname === "/keys") {
          return Response.json({
            keys: [
              jwk,
            ],
          });
        }
        if (url.pathname === "/token") {
          const token = await new SignJWT({
            email: "owner@example.com",
            email_verified: true,
            nonce,
          })
            .setProtectedHeader({
              alg: "RS256",
              kid: "test-key",
            })
            .setIssuer("https://identity.example.com")
            .setAudience("test-client")
            .setSubject("owner-subject")
            .setIssuedAt()
            .setExpirationTime("5m")
            .sign(keys.privateKey);
          return Response.json({
            id_token: token,
            access_token: "fixture-oidc-access",
            token_type: "Bearer",
          });
        }
        throw new Error("Unexpected network request");
      }),
    );
    const verifier = "fixture-pkce-verifier-with-at-least-forty-three-characters";
    const challenge = base64url.encode(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
    );
    const query = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: "https://client.example/callback",
      scope: "finance:read offline_access",
      state: "assistant-state",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: `${origin}/mcp`,
    });
    const consent = await workerFetch(`${origin}/authorize?${query}`);
    expect(consent.status).toBe(200);
    const policy = consent.headers.get("content-security-policy");
    expect(policy).toContain("https://identity.example.com");
    expect(policy).toContain("https://client.example");
    expect(policy).not.toContain("https://attacker.example");
    const body = await consent.text();
    const handle = body.match(/name="handle" value="([^"]+)"/)?.[1];
    expect(handle).toBeDefined();
    const approval = await workerFetch(`${origin}/authorize`, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/x-www-form-urlencoded",
        cookie: cookieHeader(consent),
      },
      body: new URLSearchParams({
        handle: handle ?? "",
        decision: "approve",
      }),
    });
    expect(approval.status).toBe(302);
    const upstream = new URL(approval.headers.get("location") ?? "");
    nonce = upstream.searchParams.get("nonce") ?? "";
    const callback = await workerFetch(
      `${origin}/callback?code=fixture-code&state=${upstream.searchParams.get("state")}`,
      {
        headers: {
          cookie: cookieHeader(approval),
        },
      },
    );
    expect(callback.status).toBe(302);
    const returned = new URL(callback.headers.get("location") ?? "");
    expect(returned.searchParams.get("state")).toBe("assistant-state");
    const tokenResponse = await workerFetch(`${origin}/oauth/token`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code: returned.searchParams.get("code") ?? "",
        redirect_uri: "https://client.example/callback",
        code_verifier: verifier,
        resource: `${origin}/mcp`,
      }),
    });
    expect(tokenResponse.status).toBe(200);
    const tokens = await tokenResponse.json<{
      access_token: string;
      refresh_token: string;
    }>();
    const client = new Client({
      name: "integration-test",
      version: "1.0.0",
    });
    const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
      requestInit: {
        headers: {
          authorization: `Bearer ${tokens.access_token}`,
        },
      },
      fetch: (input, init) => workerFetch(new Request(input, init)),
    });
    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(7);
      expect(tools.tools.some((tool) => tool.name === "complete_login")).toBe(false);
      const status = await client.callTool({
        name: "connection_status",
        arguments: {},
      });
      expect(status.structuredContent).toEqual({
        connections: [],
        management_url: `${origin}/connections`,
      });
      const balances = await client.callTool({
        name: "get_balances",
        arguments: {},
      });
      expect(balances.structuredContent).toEqual({
        balances: [],
        connections: [],
      });
      const history = await client.callTool({
        name: "get_balance_history",
        arguments: {},
      });
      expect(history.structuredContent).toEqual({
        observations: [],
        limit: 100,
        offset: 0,
      });
      expect(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    } finally {
      await client.close();
    }
    const replay = await workerFetch(
      `${origin}/callback?code=fixture-code&state=${upstream.searchParams.get("state")}`,
      {
        headers: {
          cookie: cookieHeader(approval),
        },
      },
    );
    expect(replay.status).toBe(400);
  });
});
function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}

function workerFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return exports.default.fetch(input, {
    ...init,
    redirect: "manual",
  });
}
