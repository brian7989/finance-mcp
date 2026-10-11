import type { Account, Connection, Preference } from "../../modules/finance/schemas.js";

export type ConnectionView = Pick<
  Connection,
  "id" | "institution" | "status" | "capabilities" | "last_success_at" | "last_error"
> & {
  canReconnect: boolean;
};
export type AccountView = Pick<
  Account,
  "id" | "connection_id" | "name" | "mask" | "type" | "subtype"
>;
export type ConnectionsData = {
  csrf: string;
  connections: ConnectionView[];
  accounts: AccountView[];
  preferences: Preference[];
  benepassEmail: string | null;
};
