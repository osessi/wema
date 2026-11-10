"use client";

import { ArrowsClockwise } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { toast } from "@wema/ui/components/ui/sonner";
import { Spinner } from "@wema/ui/components/ui/spinner";
import { useTranslations } from "next-intl";
import { read } from "../../../lib/mutate";
import { useMutation } from "../../../lib/use-mutation";

/** Relance le calcul des agrégats collectifs (sinon fait chaque nuit). */
export function ComputeButton() {
  const t = useTranslations("insights.collective");
  const { run, pending } = useMutation();
  return (
    <Button
      variant="outline"
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={async () => {
        const r = await run("POST", "/admin/collective/compute");
        if (!r.ok) {
          toast.error(t("computeFailed"));
          return;
        }
        const n = read(r.data, "notions");
        toast.success(t("computed", { count: typeof n === "number" ? n : 0 }));
      }}
    >
      {pending ? <Spinner /> : <ArrowsClockwise aria-hidden weight="bold" />}
      {pending ? t("computing") : t("compute")}
    </Button>
  );
}
