"use client";

import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { toast } from "@wema/ui/components/ui/sonner";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { useMutation } from "../../../lib/use-mutation";

/**
 * Action sensible du compte (suppression, consentement), confirmée dans un
 * `ConfirmDialog` avec une case à cocher obligatoire. Corps : `{ confirm: true }`.
 */
export function ConfirmAction({
  method,
  path,
  confirmLabel,
  buttonLabel,
  description,
  doneLabel,
  primary = false,
}: {
  method: "POST";
  path: string;
  /** Texte de la case à cocher. */
  confirmLabel: string;
  buttonLabel: string;
  description?: string;
  /** Message affiché une fois l'action faite. */
  doneLabel?: string;
  /** Bouton principal (consentement) ; sinon destructif (suppression). */
  primary?: boolean;
}) {
  const { run, pending, error } = useMutation();
  return (
    <ConfirmDialog
      trigger={
        <Button variant={primary ? "default" : "outline"} disabled={pending}>
          {buttonLabel}
        </Button>
      }
      title={buttonLabel}
      description={description}
      acknowledge={confirmLabel}
      confirmLabel={buttonLabel}
      variant={primary ? "default" : "destructive"}
      error={error ?? undefined}
      onConfirm={async () => {
        const ok = (await run(method, path, { confirm: true })).ok;
        if (ok && doneLabel) toast.success(doneLabel);
        return ok;
      }}
    />
  );
}

/** Bouton simple (annuler une suppression). */
export function SimpleAction({
  method,
  path,
  label,
}: {
  method: "DELETE" | "POST";
  path: string;
  label: string;
}) {
  const { run, pending, error } = useMutation();
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => run(method, path)}
      >
        {label}
      </Button>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
