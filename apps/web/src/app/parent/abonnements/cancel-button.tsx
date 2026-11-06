"use client";

import { Button } from "@wema/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { useBillingMutation } from "./use-billing-mutation";

export function CancelButton({ subscriptionId }: { subscriptionId: string }) {
  const t = useTranslations("billing.parent");
  const { run, pending, error } = useBillingMutation();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (window.confirm(t("cancelConfirm")))
            void run(
              "POST",
              `/parent/billing/subscriptions/${subscriptionId}/cancel`,
            );
        }}
      >
        {t("cancel")}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
