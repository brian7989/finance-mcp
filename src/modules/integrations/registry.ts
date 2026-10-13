import type { FinanceContext } from "../finance/context.js";
import type { Connection } from "../finance/schemas.js";
import { resolveBenepassProvider } from "./benepass/provider.js";
import { resolvePlaidProvider } from "./plaid/provider.js";
import type { FinanceProvider } from "./provider.js";
import { resolveUmbProvider } from "./umb/provider.js";

type ProviderDefinition = {
  resolve: (context: FinanceContext, connection: Connection) => Promise<FinanceProvider>;
  supportsReconnect: boolean;
};

const providers = {
  umb: {
    resolve: resolveUmbProvider,
    supportsReconnect: false,
  },
  benepass: {
    resolve: resolveBenepassProvider,
    supportsReconnect: false,
  },
  plaid: {
    resolve: resolvePlaidProvider,
    supportsReconnect: true,
  },
} satisfies Record<Connection["provider"], ProviderDefinition>;

export async function resolveProvider(
  context: FinanceContext,
  connection: Connection,
): Promise<FinanceProvider> {
  return providers[connection.provider].resolve(context, connection);
}
export function canReconnect(connection: Connection): boolean {
  return connection.status !== "disconnected" && providers[connection.provider].supportsReconnect;
}
