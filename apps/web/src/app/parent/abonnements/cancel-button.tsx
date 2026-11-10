"use client";

import { Button } from "@wema/ui/components/ui/button";
import { toast } from "@wema/ui/components/ui/sonner";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { useTranslations } from "next-intl";
import { useBillingMutation } from "./use-billing-mutation";

export function CancelButton({ subscriptionId }: { subscriptionId: string }) {
  const t = useTranslations("billing.parent");
  const { run, pending, error } = useBillingMutation();
  return (
    <ConfirmDialog
      variant="destructive"
      title={t("cancelTitle")}
      description={t("cancelConfirm")}
      confirmLabel={t("cancel")}
      cancelLabel={t("keep")}
      error={error}
      onConfirm={async () => {
        const result = await run(
          "POST",
          `/parent/billing/subscriptions/${subscriptionId}/cancel`,
        );
        if (!result.ok) return false;
        toast.success(t("canceled"));
        return true;
      }}
      trigger={
        <Button variant="outline" size="sm" disabled={pending}>
          {t("cancel")}
        </Button>
      }
    />
  );
}
