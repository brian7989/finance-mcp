import { ChevronRight, Ellipsis, Landmark, RefreshCw, ShieldCheck } from "lucide-react";
import { type RefObject, useRef, useState } from "react";
import type { ConnectionsData, ConnectionView } from "../../../connections-types";
import { ActionForm, ConnectionField } from "../../components/forms";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import {
  accountCount,
  connectionAccounts,
  connectionStatus,
  requiresAttention,
  syncTime,
} from "../../utils/format";
import { AccountRow } from "./account-list";
import { DisconnectDialog } from "./disconnect-dialog";

const capabilityLabels = {
  balances: "Balances",
  transactions: "Transactions",
  holdings: "Holdings",
  investment_activity: "Investment activity",
};

export function InstitutionList({ data }: { data: ConnectionsData }) {
  if (data.connections.length === 0) {
    return (
      <div className="py-20 text-center">
        <Landmark className="mx-auto mb-4 size-6 text-muted-foreground" aria-hidden="true" />
        <h3 className="font-medium">A clear view starts here</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect your first institution to bring your accounts together.
        </p>
      </div>
    );
  }
  return (
    <div className="divide-y border-y">
      {data.connections.map((connection) => (
        <InstitutionRow key={connection.id} connection={connection} data={data} />
      ))}
    </div>
  );
}
function InstitutionRow({
  connection,
  data,
}: {
  connection: ConnectionView;
  data: ConnectionsData;
}) {
  const [open, setOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const showDetails = () => setOpen(true);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-4 py-3">
        <InstitutionIdentity
          connection={connection}
          count={connectionAccounts(connection, data).length}
          onManage={showDetails}
        />
        <ConnectionStatus connection={connection} />
        <InstitutionMenu
          connection={connection}
          open={open}
          onManage={showDetails}
          triggerRef={menuTrigger}
        />
        <QuickRefreshForm connection={connection} csrf={data.csrf} />
      </div>
      <InstitutionSheet
        connection={connection}
        data={data}
        restoreFocus={() => menuTrigger.current?.focus()}
      />
    </Sheet>
  );
}
function InstitutionIdentity({
  connection,
  count,
  onManage,
}: {
  connection: ConnectionView;
  count: number;
  onManage: () => void;
}) {
  return (
    <>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
        <Landmark className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <button
        type="button"
        onClick={onManage}
        className="min-w-0 flex-1 rounded-sm text-left outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="block truncate text-sm font-medium">{connection.institution}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{accountCount(count)}</span>
      </button>
    </>
  );
}
function InstitutionMenu({
  connection,
  open,
  onManage,
  triggerRef,
}: {
  connection: ConnectionView;
  open: boolean;
  onManage: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="icon"
          aria-label={`Manage ${connection.institution}`}
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          if (open) {
            event.preventDefault();
          }
        }}
      >
        <DropdownMenuItem onSelect={onManage}>
          Manage connection
          <ChevronRight aria-hidden="true" />
        </DropdownMenuItem>
        {connection.status !== "disconnected" && (
          <DropdownMenuItem asChild>
            <button type="submit" form={`refresh-${connection.id}`}>
              <RefreshCw aria-hidden="true" />
              Refresh saved data
            </button>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
function QuickRefreshForm({ connection, csrf }: { connection: ConnectionView; csrf: string }) {
  return (
    <form id={`refresh-${connection.id}`} method="post" action="/connections/sync" hidden>
      <input type="hidden" name="csrf" value={csrf} />
      <ConnectionField id={connection.id} />
    </form>
  );
}
function ConnectionStatus({ connection }: { connection: ConnectionView }) {
  const attention = requiresAttention(connection);
  const healthy = connection.status === "connected" && !attention;
  let color = "text-muted-foreground";
  if (healthy) {
    color = "text-emerald-700";
  } else if (attention) {
    color = "text-amber-700";
  }
  return (
    <span className={`flex shrink-0 items-center gap-1.5 text-xs ${color}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      <span>{connectionStatus(connection)}</span>
    </span>
  );
}
function InstitutionSheet({
  connection,
  data,
  restoreFocus,
}: {
  connection: ConnectionView;
  data: ConnectionsData;
  restoreFocus: () => void;
}) {
  const accounts = connectionAccounts(connection, data);
  return (
    <SheetContent
      className="w-full overflow-y-auto sm:max-w-md"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        restoreFocus();
      }}
    >
      <SheetHeader className="px-6 pt-8">
        <SheetTitle>{connection.institution}</SheetTitle>
        <SheetDescription>
          {accountCount(accounts.length)} · {connectionStatus(connection)}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-7 px-6 pb-8 pt-3">
        {connection.last_error && (
          <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {connection.last_error}
          </p>
        )}
        <ConnectionInformation connection={connection} />
        <section>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">Linked accounts</h3>
          {accounts.map((account) => (
            <AccountRow key={account.id} account={account} data={data} />
          ))}
          {accounts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Accounts appear after the first successful sync.
            </p>
          )}
        </section>
        {connection.status !== "disconnected" && (
          <ConnectionActions connection={connection} data={data} />
        )}
      </div>
    </SheetContent>
  );
}
function ConnectionInformation({ connection }: { connection: ConnectionView }) {
  return (
    <dl className="space-y-3 text-xs">
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Last synced</dt>
        <dd className="text-right">{syncTime(connection.last_success_at)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Available data</dt>
        <dd className="max-w-52 text-right leading-relaxed">
          {connection.capabilities.map((capability) => capabilityLabels[capability]).join(", ")}
        </dd>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        Read-only access
      </div>
    </dl>
  );
}
function ConnectionActions({
  connection,
  data,
}: {
  connection: ConnectionView;
  data: ConnectionsData;
}) {
  return (
    <div className="space-y-3 border-t pt-5">
      <ActionForm
        action="/connections/sync"
        csrf={data.csrf}
        label="Refresh saved data"
        variant="outline"
      >
        <ConnectionField id={connection.id} />
      </ActionForm>
      {connection.canReconnect && (
        <ActionForm
          action="/connections/plaid/start"
          csrf={data.csrf}
          label="Reconnect through Plaid"
          variant="outline"
        >
          <ConnectionField id={connection.id} />
        </ActionForm>
      )}
      <DisconnectDialog connection={connection} csrf={data.csrf} />
    </div>
  );
}
