"use client";

import { Switch } from "@wema/ui/components/ui/switch";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useBillingMutation } from "../../parent/abonnements/use-billing-mutation";

/** Pose ou retire le statut « sous contrat » d'une école ou d'un réseau de profs. */
export function ContractSwitch({
  organizationId,
  name,
  underContract,
}: {
  organizationId: string;
  name: string;
  underContract: boolean;
}) {
  const t = useTranslations("billing.admin");
  const { run, pending, error } = useBillingMutation();
  // Valeur demandée, en attente de confirmation (null : dialogue fermé).
  const [asked, setAsked] = useState<boolean | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Switch
        aria-label={`${t("underContract")} : ${name}`}
        checked={underContract}
        disabled={pending}
        onCheckedChange={setAsked}
      />
      <ConfirmDialog
        open={asked !== null}
        onOpenChange={(open) => {
          if (!open) setAsked(null);
        }}
        variant={asked ? "default" : "destructive"}
        title={t(asked ? "contractOnConfirm" : "contractOffConfirm", { name })}
        description={t(asked ? "contractOnHint" : "contractOffHint")}
        confirmLabel={t("contractConfirmAction")}
        cancelLabel={t("cancel")}
        onConfirm={async () =>
          (
            await run("PUT", `/admin/billing/contracts/${organizationId}`, {
              underContract: asked === true,
            })
          ).ok
        }
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
