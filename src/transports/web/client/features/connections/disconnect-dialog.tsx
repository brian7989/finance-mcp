import type { ConnectionView } from "../../../connections-types";
import { ActionForm, ConnectionField } from "../../components/forms";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";

export function DisconnectDialog({
  connection,
  csrf,
}: {
  connection: ConnectionView;
  csrf: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="text-destructive hover:text-destructive">
          Disconnect institution
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect {connection.institution}?</AlertDialogTitle>
          <AlertDialogDescription>
            Synchronization will stop and these accounts will leave your totals. Your saved history
            will remain available.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep connected</AlertDialogCancel>
          <ActionForm
            action="/connections/disconnect"
            csrf={csrf}
            label="Disconnect"
            variant="destructive"
          >
            <ConnectionField id={connection.id} />
          </ActionForm>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
