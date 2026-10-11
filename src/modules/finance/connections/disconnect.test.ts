import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { fixtureConnection } from "../../../../test/finance-fixtures.js";
import { createDatabase } from "../../../database/client.js";
import { saveConnection } from "../../../database/repositories/connections.js";
import { resolveBenepassProvider } from "../../integrations/benepass/provider.js";

vi.mock("../../integrations/benepass/provider.js", () => ({
  resolveBenepassProvider: vi.fn(),
}));
afterEach(() => {
  vi.restoreAllMocks();
});

describe("provider-independent disconnect lifecycle", () => {
  it("retries a failed tokenless-provider logout and stops retrying after success", async () => {
    const disconnect = vi
      .fn()
      .mockRejectedValueOnce(new Error("Temporary logout failure"))
      .mockResolvedValue(undefined);
    vi.mocked(resolveBenepassProvider).mockResolvedValue({
      readMetadata: async () => ({
        institution: "Benepass",
        capabilities: [
          "balances",
        ],
      }),
      readSnapshot: async () => ({
        accounts: [],
        balances: [],
        holdings: null,
      }),
      readChanges: async () => ({
        cash: null,
        investments: null,
      }),
      disconnect,
    });
    const stub = env.FINANCE_STORE.getByName(crypto.randomUUID());
    await runInDurableObject(stub, async (instance, context) => {
      saveConnection(
        createDatabase(context.storage),
        {
          ...fixtureConnection("benepass"),
          provider: "benepass",
        },
        null,
      );
      await expect(instance.disconnect("benepass")).rejects.toThrow("Temporary logout failure");
      expect((await instance.connections()).connections[0]).toMatchObject({
        status: "disconnected",
        last_error: "Provider disconnection is pending. Retry disconnecting.",
      });
      await instance.disconnect("benepass");
      expect((await instance.connections()).connections[0]).toMatchObject({
        status: "disconnected",
        last_error: null,
      });
      await instance.disconnect("benepass");
    });
    expect(disconnect).toHaveBeenCalledTimes(2);
  });
});
