"use client";

import { Check } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { useLearnerMutation } from "./use-learner-mutation";

/** Marque une relance comme lue. */
export function NudgeReadButton({ id }: { id: string }) {
  const t = useTranslations("learner.home");
  const { run, pending, error } = useLearnerMutation();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run("POST", `/learner/nudges/${id}/read`)}
      >
        <Check />
        {t("markRead")}
      </Button>
      {error && <p className="text-xs text-muted-foreground">{error}</p>}
    </div>
  );
}
