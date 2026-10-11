import { LoaderCircle } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";
import { Button } from "./ui/button";

type ActionFormProps = {
  action: string;
  csrf: string;
  label: string;
  children?: ReactNode;
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
};

export function ActionForm({
  action,
  csrf,
  label,
  children,
  variant = "default",
  className,
}: ActionFormProps) {
  const [pending, setPending] = useState(false);
  return (
    <form method="post" action={action} onSubmit={() => setPending(true)} className={className}>
      <input type="hidden" name="csrf" value={csrf} />
      {children}
      <Button type="submit" variant={variant} disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {pending ? "Please wait…" : label}
      </Button>
    </form>
  );
}
export function ConnectionField({ id }: { id: string }) {
  return <input type="hidden" name="connection_id" value={id} />;
}
