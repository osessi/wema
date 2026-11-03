"use client";

import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { Checkbox } from "@wema/ui/components/ui/checkbox";
import { Label } from "@wema/ui/components/ui/label";
import { useId, useState } from "react";
import { useMutation } from "../../../lib/use-mutation";

/**
 * Action qui demande une case cochée avant d'être envoyée (suppression,
 * consentement) : le corps envoyé est `{ confirm: true }`.
 */
export function ConfirmAction({
  method,
  path,
  confirmLabel,
  buttonLabel,
  primary = false,
}: {
  method: "POST";
  path: string;
  confirmLabel: string;
  buttonLabel: string;
  /** Bouton principal (consentement) ; sinon discret (suppression). */
  primary?: boolean;
}) {
  const id = useId();
  const [checked, setChecked] = useState(false);
  const { run, pending, error } = useMutation();
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => setChecked(v === true)}
        />
        <Label htmlFor={id} className="font-normal leading-snug">
          {confirmLabel}
        </Label>
      </div>
      <Button
        variant={primary ? "default" : "outline"}
        disabled={!checked || pending}
        onClick={async () => {
          const result = await run(method, path, { confirm: true });
          if (result.ok) setChecked(false);
        }}
      >
        {buttonLabel}
      </Button>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
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
