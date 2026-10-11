import { ArrowUpRight, ChevronDown, Landmark, Plus, ShieldCheck } from "lucide-react";
import type { ConnectionsData } from "../../../connections-types";
import { ActionForm } from "../../components/forms";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";

export function ConnectDialog({ data }: { data: ConnectionsData }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          Connect institution
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect an institution</DialogTitle>
          <DialogDescription className="sr-only">
            Connect through Plaid or choose another institution.
          </DialogDescription>
        </DialogHeader>
        <PlaidOption csrf={data.csrf} />
        {data.benepassEmail && <OtherInstitutions data={data} />}
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Read-only. No transfers or trades.
        </p>
      </DialogContent>
    </Dialog>
  );
}
function PlaidOption({ csrf }: { csrf: string }) {
  return (
    <div className="rounded-xl border p-5">
      <Landmark className="mb-4 size-5 text-muted-foreground" aria-hidden="true" />
      <h3 className="text-sm font-medium">Banks & investments</h3>
      <p className="mt-1 text-sm text-muted-foreground">Banking, brokerage & retirement.</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Powered by Plaid</span>
        <ActionForm action="/connections/plaid/start" csrf={csrf} label="Continue with Plaid" />
      </div>
    </div>
  );
}
function OtherInstitutions({ data }: { data: ConnectionsData }) {
  return (
    <Collapsible className="border-t pt-1">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="group w-full justify-between px-0 hover:bg-transparent">
          Other institutions
          <ChevronDown
            className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <BenepassOption data={data} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function BenepassOption({ data }: { data: ConnectionsData }) {
  return (
    <div className="py-3">
      <h3 className="text-sm font-medium">
        Benepass HSA
        <ArrowUpRight className="ml-1 inline size-3.5 text-muted-foreground" aria-hidden="true" />
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        HSA cash and investments, connected directly.
      </p>
      <p className="mt-2 break-all text-xs text-muted-foreground">Code to {data.benepassEmail}</p>
      <ActionForm
        action="/connections/benepass/start"
        csrf={data.csrf}
        label="Connect Benepass"
        variant="outline"
        className="mt-4 space-y-4"
      >
        <Label className="flex items-start gap-2 text-xs font-normal leading-relaxed text-muted-foreground">
          <Checkbox name="registration" value="approved" className="mt-0.5" />
          Set up email login if needed.
        </Label>
      </ActionForm>
    </div>
  );
}
