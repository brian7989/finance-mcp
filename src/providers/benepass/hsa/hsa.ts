import type * as z from "zod";
import { ApiHttpError, SchemaError } from "../../../errors.js";
import { availableBalance, isHsaAccount, listAccounts } from "../accounts.js";
import { type Account, type Workspace, WorkspaceSchema } from "../accounts.schemas.js";
import type { BenepassClient } from "../client.js";
import { hsaPath, PATHS } from "../constants.js";
import { parseItems, parseWith } from "../parsing.js";
import {
  AmountSchema,
  HsaDetailsSchema,
  HsaInputSchema,
  type HsaSummarySchema,
  PortfolioBalanceSchema,
  PositionsSchema,
} from "./hsa.schemas.js";

type HsaInput = z.infer<typeof HsaInputSchema>;
type HsaScope = {
  account_id: string;
  workspace_id: string;
};
type HsaSummary = z.infer<typeof HsaSummarySchema>;
type PortfolioBalance = z.infer<typeof PortfolioBalanceSchema>;
type Amount = z.infer<typeof AmountSchema>;

const valuationNote =
  "Market values may be delayed. fetched_at is retrieval time, not market valuation time.";

export class HsaReader {
  constructor(private readonly api: BenepassClient) {}

  async accountDetails(args: HsaInput) {
    const input = HsaInputSchema.parse(args);
    const workspaceId = await this.resolveWorkspaceId(input);
    return this.api.get(PATHS.hsaAccountDetails, HsaDetailsSchema, {
      workspaceId,
    });
  }

  async summary(args: HsaInput): Promise<HsaSummary> {
    const scope = await this.resolveHsaScope(args);
    try {
      const balance = await this.readPortfolioBalance(scope);
      return buildAvailableSummary(scope, balance);
    } catch (error) {
      if (!isMissingResource(error)) {
        throw error;
      }
      const cash = await this.readFallbackCash(scope);
      return buildPartialSummary(scope, cash);
    }
  }

  async investments(args: HsaInput) {
    const summary = await this.summary(args);
    if (summary.status !== "available") {
      return withoutHoldings(summary);
    }
    try {
      const holdings = await this.readHoldings(summary);
      return {
        ...summary,
        holdings,
        holdings_status: "available" as const,
      };
    } catch (error) {
      if (!isMissingResource(error)) {
        throw error;
      }
      return withoutHoldings(summary);
    }
  }

  private async resolveHsaScope(args: HsaInput): Promise<HsaScope> {
    const input = HsaInputSchema.parse(args);
    const workspaceId = await this.resolveWorkspaceId(input);
    const accountId = await this.resolveAccountId(input.account_id, workspaceId);
    return {
      account_id: accountId,
      workspace_id: workspaceId,
    };
  }

  private async resolveWorkspaceId(input: HsaInput): Promise<string> {
    if (input.workspace_id) {
      return input.workspace_id;
    }
    const workspaces = await this.readWorkspaces();
    return selectPersonalWorkspace(workspaces).id;
  }

  private async readWorkspaces(): Promise<Workspace[]> {
    const payload = await this.api.getJson(PATHS.workspaces, {
      skipWorkspaceHeader: true,
    });
    return parseItems(WorkspaceSchema, payload, "workspaces");
  }

  private async resolveAccountId(
    explicitId: string | undefined,
    workspaceId: string,
  ): Promise<string> {
    if (explicitId) {
      return explicitId;
    }
    const accounts = await listAccounts(this.api, {
      workspaceId,
    });
    return selectOnlyHsaAccount(accounts).id;
  }

  private async readPortfolioBalance(scope: HsaScope): Promise<PortfolioBalance> {
    const payload = await this.api.getJson(
      hsaPath(scope.account_id, "balance"),
      requestScope(scope),
    );
    return parseWith(PortfolioBalanceSchema, payload, "HSA portfolio balance");
  }

  private async readHoldings(scope: HsaScope) {
    const payload = await this.api.getJson(
      hsaPath(scope.account_id, "positions"),
      requestScope(scope),
    );
    return parseWith(PositionsSchema, payload, "HSA holdings").data;
  }

  private async readFallbackCash(scope: HsaScope): Promise<Amount | null> {
    const accounts = await listAccounts(this.api, requestScope(scope));
    const account = findSelectedHsaAccount(accounts, scope.account_id);
    return parseAvailableCash(account);
  }
}

function requestScope(scope: HsaScope) {
  return {
    workspaceId: scope.workspace_id,
  };
}

function selectPersonalWorkspace(workspaces: Workspace[]): Workspace {
  // HSA assets belong to the personal workspace, independent of employment benefits.
  const personal = workspaces.filter(isPersonalWorkspace);
  const candidates = personal.length ? personal : workspaces;
  const workspace = candidates[0];
  if (candidates.length !== 1 || !workspace) {
    throw new SchemaError("HSA workspace is ambiguous or unavailable. Pass workspace_id.");
  }
  return workspace;
}

function isPersonalWorkspace(workspace: Workspace): boolean {
  return workspace.type === "user";
}

function selectOnlyHsaAccount(accounts: Account[]): Account {
  const hsaAccounts = accounts.filter(isHsaAccount);
  if (hsaAccounts.length === 0) {
    throw new SchemaError("No HSA account found in this workspace.");
  }
  const account = hsaAccounts[0];
  if (hsaAccounts.length !== 1 || !account) {
    throw new SchemaError("Multiple HSA accounts found. Pass account_id.");
  }
  return account;
}

function findSelectedHsaAccount(accounts: Account[], accountId: string): Account | undefined {
  return accounts.find((account) => account.id === accountId && isHsaAccount(account));
}

function parseAvailableCash(account: Account | undefined): Amount | null {
  const balance = availableBalance(account?.balances);
  if (balance?.amount === undefined || balance.formatted_local_amount === undefined) {
    return null;
  }
  return parseWith(
    AmountSchema,
    {
      amount: String(balance.amount),
      formatted: balance.formatted_local_amount,
    },
    "HSA cash balance",
  );
}

function summaryMetadata(scope: HsaScope) {
  return {
    ...scope,
    fetched_at: new Date().toISOString(),
    valuation_note: valuationNote,
  };
}

function buildAvailableSummary(scope: HsaScope, balance: PortfolioBalance): HsaSummary {
  return {
    ...summaryMetadata(scope),
    status: "available",
    currency: balance.currency,
    cash: amount(balance.account_balance, balance.account_balance_formatted),
    investments: amount(balance.balance, balance.balance_formatted),
    brokerage_cash: amount(balance.cash_balance, balance.cash_balance_formatted),
    total: amount(balance.total_value, balance.total_value_formatted),
    pending_transfer_in: balance.pending_transfer_in,
    pending_transfer_out: balance.pending_transfer_out ?? null,
    availability_reason: null,
  };
}

function amount(value: string, formatted: string): Amount {
  return {
    amount: value,
    formatted,
  };
}

function buildPartialSummary(scope: HsaScope, cash: Amount | null): HsaSummary {
  // Missing investment data is unknown, never zero or a reason to discard known cash.
  return {
    ...summaryMetadata(scope),
    status: cash ? "partial" : "unavailable",
    currency: null,
    cash,
    investments: null,
    brokerage_cash: null,
    total: null,
    pending_transfer_in: null,
    pending_transfer_out: null,
    availability_reason:
      "Benepass returned 404 for the investment balance endpoint. Investments and total are unknown.",
  };
}

function isMissingResource(error: unknown): boolean {
  return error instanceof ApiHttpError && error.status === 404;
}

function withoutHoldings(summary: HsaSummary) {
  return {
    ...summary,
    holdings: null,
    holdings_status: "unavailable" as const,
  };
}
