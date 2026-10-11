import { ChevronRight, Wallet } from "lucide-react";
import type { AccountView, ConnectionsData, ConnectionView } from "../../../connections-types";
import { ActionForm } from "../../components/forms";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../components/ui/sheet";
import { accountLabel, accountSuffix, accountType, connectionAccounts } from "../../utils/format";

export function AccountList({ data }: { data: ConnectionsData }) {
  if (data.accounts.length === 0) {
    return <EmptyAccounts />;
  }
  return (
    <div>
      {data.connections.map((connection) => (
        <AccountGroup key={connection.id} connection={connection} data={data} />
      ))}
    </div>
  );
}
function AccountGroup({ connection, data }: { connection: ConnectionView; data: ConnectionsData }) {
  const accounts = connectionAccounts(connection, data);
  if (accounts.length === 0) {
    return null;
  }
  return (
    <section aria-label={`${connection.institution} accounts`} className="mb-6">
      <h3 className="sticky top-0 z-10 mb-2 bg-background py-2 text-xs font-medium text-muted-foreground">
        {connection.institution}
      </h3>
      <div className="divide-y border-y">
        {accounts.map((account) => (
          <AccountRow key={account.id} account={account} data={data} />
        ))}
      </div>
    </section>
  );
}
export function AccountRow({ account, data }: { account: AccountView; data: ConnectionsData }) {
  const preference = data.preferences.find((value) => value.account_id === account.id);
  const included = preference?.include_in_net_worth !== false;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto min-h-16 w-full justify-between gap-4 rounded-none px-0 py-3 text-left hover:bg-muted/40"
          aria-label={`Edit ${accountLabel(account, data)} preferences`}
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">{accountLabel(account, data)}</span>
            <span className="block text-xs font-normal text-muted-foreground">
              {accountType(account)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-4">
            {!included && (
              <span className="text-xs font-normal text-muted-foreground">Excluded</span>
            )}
            <span className="max-w-36 whitespace-normal text-right text-xs font-normal text-muted-foreground">
              {accountSuffix(account)}
            </span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
        </Button>
      </SheetTrigger>
      <AccountSheet account={account} data={data} />
    </Sheet>
  );
}
function AccountSheet({ account, data }: { account: AccountView; data: ConnectionsData }) {
  const preference = data.preferences.find((value) => value.account_id === account.id);
  const institution = data.connections.find(
    (connection) => connection.id === account.connection_id,
  )?.institution;
  return (
    <SheetContent className="w-full overflow-y-auto sm:max-w-md">
      <SheetHeader className="px-6 pt-8">
        <SheetTitle>{accountLabel(account, data)}</SheetTitle>
        <SheetDescription>
          {institution} · {accountSuffix(account)}
        </SheetDescription>
      </SheetHeader>
      <ActionForm
        action="/accounts/preferences"
        csrf={data.csrf}
        label="Save preferences"
        className="space-y-7 px-6 pb-8 pt-3"
      >
        <input type="hidden" name="account_id" value={account.id} />
        <div className="space-y-2">
          <Label htmlFor={`label-${account.id}`}>Display name</Label>
          <Input
            id={`label-${account.id}`}
            name="label"
            maxLength={100}
            defaultValue={preference?.label ?? ""}
            placeholder={account.name}
          />
        </div>
        <div className="space-y-5">
          <PreferenceCheckbox
            name="net_worth"
            title="Include in net worth"
            checked={preference?.include_in_net_worth !== false}
          />
          <PreferenceCheckbox
            name="spending"
            title="Include in spending reports"
            checked={preference?.include_in_spending !== false}
          />
        </div>
      </ActionForm>
    </SheetContent>
  );
}
function PreferenceCheckbox({
  name,
  title,
  checked,
}: {
  name: string;
  title: string;
  checked: boolean;
}) {
  return (
    <Label className="flex min-h-11 items-center gap-3">
      <Checkbox name={name} defaultChecked={checked} />
      <span className="text-sm font-normal">{title}</span>
    </Label>
  );
}
function EmptyAccounts() {
  return (
    <div className="py-20 text-center">
      <Wallet className="mx-auto mb-4 size-6 text-muted-foreground" aria-hidden="true" />
      <h3 className="font-medium">Your accounts will appear here</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Connect an institution and wait for its first successful sync.
      </p>
    </div>
  );
}
