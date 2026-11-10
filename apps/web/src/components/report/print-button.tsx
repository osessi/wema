"use client";

import { Printer } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";

/** Ouvre l'impression du navigateur (qui permet d'enregistrer en PDF). */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer aria-hidden />
      {label}
    </Button>
  );
}
