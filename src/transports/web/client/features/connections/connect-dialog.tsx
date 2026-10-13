import { Plus } from "lucide-react";
import type { ConnectionsData } from "../../../connections-types";
import { ActionForm } from "../../components/forms";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
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
          <DialogTitle>Connect institution</DialogTitle>
          <DialogDescription className="sr-only">
            Choose a connection option. Only one option is expanded at a time.
          </DialogDescription>
        </DialogHeader>
        <Accordion type="single" collapsible defaultValue="plaid">
          <PlaidOption csrf={data.csrf} />
          <OtherInstitutions data={data} />
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}
function PlaidOption({ csrf }: { csrf: string }) {
  return (
    <AccordionItem value="plaid">
      <AccordionTrigger className="hover:no-underline">Plaid</AccordionTrigger>
      <AccordionContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Banks, credit cards, investments & retirement.
        </p>
        <ActionForm action="/connections/plaid/start" csrf={csrf} label="Continue with Plaid" />
      </AccordionContent>
    </AccordionItem>
  );
}
function OtherInstitutions({ data }: { data: ConnectionsData }) {
  return (
    <>
      <p className="pt-5 text-xs text-muted-foreground">Other institutions</p>
      {data.benepassEmail && <BenepassOption data={data} />}
      <UmbOption csrf={data.csrf} />
    </>
  );
}
function BenepassOption({ data }: { data: ConnectionsData }) {
  return (
    <AccordionItem value="benepass">
      <AccordionTrigger className="hover:no-underline">Benepass HSA</AccordionTrigger>
      <AccordionContent className="space-y-3">
        <p className="text-sm text-muted-foreground">HSA cash & investments.</p>
        <p className="break-all text-xs text-muted-foreground">Code to {data.benepassEmail}</p>
        <ActionForm
          action="/connections/benepass/start"
          csrf={data.csrf}
          label="Connect Benepass"
          className="space-y-4"
        >
          <Label className="flex items-start gap-2 text-xs font-normal leading-relaxed text-muted-foreground">
            <Checkbox name="registration" value="approved" className="mt-0.5" />
            Set up email login if needed.
          </Label>
        </ActionForm>
      </AccordionContent>
    </AccordionItem>
  );
}

function UmbOption({ csrf }: { csrf: string }) {
  return (
    <AccordionItem value="umb">
      <AccordionTrigger className="hover:no-underline">UMB HSA</AccordionTrigger>
      <AccordionContent>
        <ActionForm
          action="/connections/umb/start"
          csrf={csrf}
          label="Connect UMB"
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="umb-username">Username</Label>
            <Input
              id="umb-username"
              name="username"
              autoComplete="username"
              maxLength={200}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="umb-password">Password</Label>
            <Input
              id="umb-password"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={500}
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Your password is used once and never stored. UMB may require verification or a new
            sign-in when its session expires.
          </p>
        </ActionForm>
      </AccordionContent>
    </AccordionItem>
  );
}
