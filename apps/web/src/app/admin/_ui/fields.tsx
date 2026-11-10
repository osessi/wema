"use client";

import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Checkbox } from "@wema/ui/components/ui/checkbox";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import { NativeSelect } from "@wema/ui/components/ui/native-select";
import { Textarea } from "@wema/ui/components/ui/textarea";
import { cn } from "@wema/ui/lib/utils";
import { type ComponentProps, type ReactNode, useId } from "react";

// Champs de formulaire du back-office et de l'authentification, assemblés à
// partir des composants shadcn (libellé, aide, erreur). Aucun texte en dur.

interface FieldShell {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: FieldShell & {
  id: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  className,
  ...rest
}: FieldShell & ComponentProps<"input">) {
  const id = useId();
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      className={className}
    >
      <Input id={id} aria-invalid={error ? true : undefined} {...rest} />
    </Field>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  className,
  ...rest
}: FieldShell & ComponentProps<"textarea">) {
  const id = useId();
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      className={className}
    >
      <Textarea id={id} aria-invalid={error ? true : undefined} {...rest} />
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...rest
}: FieldShell & ComponentProps<"select">) {
  const id = useId();
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      className={className}
    >
      <NativeSelect id={id} aria-invalid={error ? true : undefined} {...rest}>
        {children}
      </NativeSelect>
    </Field>
  );
}

export function CheckboxField({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <div className="grid gap-1">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Message d'état : « error » pour une vraie erreur, sinon neutre. */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success" | "warning";
  children: ReactNode;
}) {
  return (
    <Alert
      variant={tone === "error" ? "destructive" : "default"}
      role={tone === "error" ? "alert" : "status"}
    >
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
