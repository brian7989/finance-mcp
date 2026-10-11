import type * as z from "zod";
import { SchemaError } from "../../errors.js";
import { type Workspace, WorkspaceSchema } from "./accounts.schemas.js";
import { PATHS } from "./constants.js";
import { parseItems, parseWith } from "./parsing.js";
import { type ReadResult, unwrapRead } from "./read-result.js";

export type ApiGetOptions = {
  query?: Record<string, string | number | undefined>;
  workspaceId?: string;
  skipWorkspaceHeader?: boolean;
};
export interface AuthenticatedReader {
  read(path: string, options: ApiGetOptions): Promise<ReadResult>;
}
export class BenepassClient {
  constructor(private readonly reader: AuthenticatedReader) {}
  async get<T>(path: string, schema: z.ZodType<T>, options: ApiGetOptions = {}): Promise<T> {
    const payload = await this.getJson(path, options);
    return parseWith(schema, payload, "API resource");
  }
  async getJson(path: string, options: ApiGetOptions = {}): Promise<unknown> {
    if (options.skipWorkspaceHeader) {
      return unwrapRead(await this.reader.read(path, options));
    }
    const workspaceId = options.workspaceId ?? (await this.resolveWorkspaceId());
    return unwrapRead(
      await this.reader.read(path, {
        ...options,
        workspaceId,
      }),
    );
  }
  private async resolveWorkspaceId(): Promise<string> {
    const payload = unwrapRead(await this.reader.read(PATHS.workspaces, {}));
    const workspaces = parseItems(WorkspaceSchema, payload, "workspaces");
    return selectEmploymentWorkspace(workspaces).id;
  }
}
function selectEmploymentWorkspace(workspaces: Workspace[]): Workspace {
  const employment = workspaces.filter(isEmploymentWorkspace);
  const candidates = employment.length ? employment : workspaces;
  const workspace = candidates[0];
  if (candidates.length !== 1 || !workspace) {
    throw new SchemaError("Workspace is ambiguous or unavailable. Pass workspace_id.");
  }
  return workspace;
}
function isEmploymentWorkspace(workspace: Workspace): boolean {
  return workspace.type === "employment";
}
