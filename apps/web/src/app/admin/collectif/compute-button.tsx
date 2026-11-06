"use client";

import { Button } from "@wema/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { read } from "../../../lib/mutate";
import { useMutation } from "../../../lib/use-mutation";

/** Relance le calcul des agrégats collectifs (sinon fait chaque nuit). */
export function ComputeButton() {
  const t = useTranslations("insights.collective");
  const { run, pending, error } = useMutation();
  const [done, setDone] = useState<number | null>(null);
  return (
    <div className="flex items-center gap-3">
      {done !== null && (
        <span className="text-sm text-muted-foreground" role="status">
          {t("computed", { count: done })}
        </span>
      )}
      {error && (
        <span className="text-sm text-destructive" role="alert">
          {error}
        </span>
      )}
      <Button
        variant="outline"
        disabled={pending}
        onClick={async () => {
          const r = await run("POST", "/admin/collective/compute");
          const n = r.ok ? read(r.data, "notions") : null;
          setDone(typeof n === "number" ? n : null);
        }}
      >
        {t("compute")}
      </Button>
    </div>
  );
}
