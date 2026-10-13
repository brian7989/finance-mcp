import { beginUmbLogin, completeUmbCode, sendUmbCode } from "./auth.js";

afterEach(() => vi.restoreAllMocks());
it("completes MFA in Workers without retaining the password", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response('<input name="__RequestVerificationToken" value="synthetic-csrf">'),
    )
    .mockResolvedValueOnce(new Response('<script>ticket: "synthetic&#x2B;ticket=="</script>'))
    .mockResolvedValueOnce(
      Response.json({
        Email: "fixture@example.com",
        MobileNum: null,
        Phone: null,
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        success: true,
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        success: true,
      }),
    )
    .mockResolvedValueOnce(
      new Response("dashboard", {
        headers: {
          "set-cookie": "sid=synthetic-session; Path=/; Secure; HttpOnly",
        },
      }),
    )
    .mockResolvedValueOnce(Response.json([]));
  const login = await beginUmbLogin({
    username: "fixture-user",
    password: "synthetic-only-password",
  });
  expect(login.methods).toEqual([
    {
      method: "email",
      label: "f•••@example.com",
    },
  ]);
  expect(login.state.ticket).toBe("synthetic+ticket==");
  expect(JSON.stringify(login.state)).not.toContain("synthetic-only-password");
  const sent = await sendUmbCode(login.state, "email");
  const session = await completeUmbCode(sent, "123456");
  expect(session).toContain("synthetic-session");
  expect(session).not.toContain("synthetic-only-password");
  const loginForm = fetcher.mock.calls[1]?.[1]?.body as URLSearchParams;
  expect(loginForm.get("__RequestVerificationToken")).toBe("synthetic-csrf");
  const codeForm = fetcher.mock.calls[3]?.[1]?.body as URLSearchParams;
  expect(codeForm.get("ticket")).toBe("synthetic+ticket==");
  expect(codeForm.get("type")).toBe("1");
});
