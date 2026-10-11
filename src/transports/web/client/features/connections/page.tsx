import { Landmark, Layers, Wallet } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { ConnectionsData } from "../../../connections-types";
import { ActionForm } from "../../components/forms";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { accountCount } from "../../utils/format";
import { AccountList } from "./account-list";
import { ConnectDialog } from "./connect-dialog";
import { InstitutionList } from "./institution-list";

type WorkspaceView = "institutions" | "accounts";

export function ConnectionsPage({ data }: { data: ConnectionsData }) {
  const [view, setView] = useState<WorkspaceView>("institutions");
  return (
    <Tabs
      value={view}
      onValueChange={(value) => setView(value === "accounts" ? "accounts" : "institutions")}
      className="h-dvh min-h-0 gap-0 overflow-hidden md:grid md:grid-cols-[200px_minmax(0,1fr)]"
    >
      <WorkspaceSidebar data={data} />
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden bg-background px-5 py-6 sm:px-10 md:px-12 md:py-9">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col">
          <PageHeader data={data} view={view} />
          <TabsContent
            value="institutions"
            className="mt-7 min-h-0 overflow-y-auto overscroll-contain"
          >
            <InstitutionList data={data} />
          </TabsContent>
          <TabsContent value="accounts" className="mt-7 min-h-0 overflow-y-auto overscroll-contain">
            <AccountList data={data} />
          </TabsContent>
        </div>
      </main>
    </Tabs>
  );
}
function WorkspaceSidebar({ data }: { data: ConnectionsData }) {
  return (
    <aside className="flex shrink-0 border-b bg-sidebar px-5 py-4 md:min-h-0 md:flex-col md:border-r md:border-b-0 md:px-4 md:py-8">
      <div className="flex items-center gap-2.5 font-semibold tracking-tight md:px-3">
        <Layers className="size-5" aria-hidden="true" />
        Finance
      </div>
      <TabsList
        aria-label="Workspace navigation"
        className="ml-auto group-data-[orientation=horizontal]/tabs:h-auto gap-1 bg-transparent p-0 md:mt-9 md:ml-0 md:w-full md:flex-col"
      >
        <NavigationTab
          value="institutions"
          label="Connections"
          icon={<Landmark aria-hidden="true" />}
        />
        <NavigationTab value="accounts" label="Accounts" icon={<Wallet aria-hidden="true" />} />
      </TabsList>
      <div className="ml-2 md:hidden">
        <ActionForm action="/sign-out" csrf={data.csrf} label="Sign out" variant="ghost" />
      </div>
      <div className="mt-auto hidden space-y-4 px-3 pt-12 md:block">
        <p className="text-xs text-muted-foreground">Sync · Midnight Pacific</p>
        <ActionForm action="/sign-out" csrf={data.csrf} label="Sign out" variant="ghost" />
      </div>
    </aside>
  );
}
function NavigationTab({ value, label, icon }: { value: string; label: string; icon: ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="h-10 flex-none gap-2 px-3 py-2.5 text-xs text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs md:w-full md:justify-start [&_svg]:size-4"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </TabsTrigger>
  );
}
function PageHeader({ data, view }: { data: ConnectionsData; view: WorkspaceView }) {
  const titles = {
    institutions: "Connections",
    accounts: "Accounts",
  };
  const counts = {
    institutions: `${data.connections.length} institutions`,
    accounts: accountCount(data.accounts.length),
  };
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titles[view]}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{counts[view]}</p>
      </div>
      <ConnectDialog data={data} />
    </header>
  );
}
