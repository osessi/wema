"use client";

import { Button } from "@wema/ui/components/ui/button";
import { toast } from "@wema/ui/components/ui/sonner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { mutate } from "../../../lib/mutate";

/**
 * Validation par les routes existantes : une notion passe « vérifiée »
 * (même écriture que l'éditeur du référentiel) ; un exercice est validé
 * après vérification d'une variante par niveau (services/math).
 */
export function ValidateButton({
  target,
  label,
}: {
  target:
    | {
        kind: "notion";
        id: string;
        unitId: string;
        code: string;
        name: string;
        description: string;
        position: number;
      }
    | { kind: "exercise"; id: string };
  label: string;
}) {
  const t = useTranslations("reviewQueue");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function validate() {
    setPending(true);
    const result =
      target.kind === "notion"
        ? await mutate("PATCH", `/admin/curriculum/notions/${target.id}`, {
            unitId: target.unitId,
            code: target.code,
            name: target.name,
            description: target.description,
            position: target.position,
            verified: true,
          })
        : await mutate("POST", `/admin/exercises/${target.id}/validate`);
    setPending(false);
    if (!result.ok) {
      toast.error(t("error"), { description: result.code });
      return;
    }
    toast.success(
      target.kind === "notion"
        ? t("verified", { name: target.name })
        : t("validated"),
    );
    router.refresh();
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={validate}
      aria-label={label}
    >
      {t(target.kind === "notion" ? "verify" : "validate")}
    </Button>
  );
}
