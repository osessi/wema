"use client";

import { type ReactNode, useId, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";

export interface ConfirmDialogProps {
  /** Élément qui ouvre le dialogue (un `Button`, en général). */
  trigger?: ReactNode | undefined;
  /** Ouverture contrôlée. */
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  title: ReactNode;
  description?: ReactNode | undefined;
  /** Contenu libre sous la description (récapitulatif, conséquences…). */
  children?: ReactNode | undefined;
  confirmLabel?: string | undefined;
  /** Libellé du bouton pendant l'action. */
  pendingLabel?: string | undefined;
  cancelLabel?: string | undefined;
  /** `destructive` : bouton de confirmation rouge (suppression, retrait). */
  variant?: "default" | "destructive" | undefined;
  /**
   * Case à cocher exigée avant de confirmer (suppression d'un compte,
   * consentement), comme l'ancien `ConfirmAction`.
   */
  acknowledge?: string | undefined;
  /**
   * Action confirmée. Le dialogue reste ouvert pendant l'attente et se
   * ferme si elle réussit ; renvoyer `false` le garde ouvert.
   */
  onConfirm: () => unknown;
  /** Message d'erreur à afficher dans le dialogue (rôle `alert`). */
  error?: ReactNode | undefined;
  /** Pastille en tête (un `GlowTile`, par exemple). */
  icon?: ReactNode | undefined;
}

/**
 * Confirmation d'une action sensible, construite sur `ui/alert-dialog` (Radix : rôle `alertdialog`, focus piégé, Échap pour annuler). Remplace
 * `app/compte/_components/confirm-action.tsx`.
 */
export function ConfirmDialog({
  trigger,
  open: openProp,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirmer",
  pendingLabel,
  cancelLabel = "Annuler",
  variant = "default",
  acknowledge,
  onConfirm,
  error,
  icon,
}: ConfirmDialogProps) {
  const checkId = useId();
  const [innerOpen, setInnerOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const open = openProp ?? innerOpen;

  function setOpen(next: boolean) {
    if (pending) return;
    if (!next) setChecked(false);
    setInnerOpen(next);
    onOpenChange?.(next);
  }

  async function confirm() {
    setPending(true);
    let result: unknown;
    try {
      result = await onConfirm();
    } finally {
      setPending(false);
    }
    if (result !== false) {
      setChecked(false);
      setInnerOpen(false);
      onOpenChange?.(false);
    }
  }

  const blocked = pending || (acknowledge !== undefined && !checked);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      ) : null}
      <AlertDialogContent
        data-variant={variant}
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <AlertDialogHeader>
          {icon ? (
            <AlertDialogMedia className="border-0 bg-transparent">
              {icon}
            </AlertDialogMedia>
          ) : null}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        {children}
        {acknowledge !== undefined ? (
          <div className="flex items-start gap-3">
            <Checkbox
              id={checkId}
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
            />
            <Label htmlFor={checkId} className="leading-snug font-normal">
              {acknowledge}
            </Label>
          </div>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="rounded-control bg-destructive-soft px-3 py-2 text-sm text-destructive-text"
          >
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
          {/* Pas d'`AlertDialogAction` : elle fermerait le dialogue avant la fin de l'action. */}
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={blocked}
            aria-busy={pending || undefined}
            onClick={() => void confirm()}
          >
            {pending && pendingLabel ? pendingLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
