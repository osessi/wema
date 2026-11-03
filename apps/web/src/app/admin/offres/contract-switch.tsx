"use client";

import { Switch } from "@wema/ui/components/ui/switch";
import { useTranslations } from "next-intl";
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
  return (
    <div className="flex flex-col items-end gap-1">
      <Switch
        aria-label={`${t("underContract")} : ${name}`}
        checked={underContract}
        disabled={pending}
        onCheckedChange={(on) =>
          void run("PUT", `/admin/billing/contracts/${organizationId}`, {
            underContract: on,
          })
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
