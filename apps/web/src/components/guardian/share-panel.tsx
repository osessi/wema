"use client";

import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Label } from "@wema/ui/components/ui/label";
import { Switch } from "@wema/ui/components/ui/switch";
import { useTranslations } from "next-intl";
import type { HealthShares } from "../../lib/guardian-types";
import { useMutation } from "../../lib/use-mutation";

/** Partage des besoins déclarés avec les autres organisations de l'enfant : au choix du parent. */
export function SharePanel({
  base,
  organizations,
}: {
  base: string;
  organizations: HealthShares;
}) {
  const t = useTranslations("guardian.share");
  const { run, pending, error } = useMutation();
  if (organizations.length === 0)
    return <p className="text-sm text-muted-foreground">{t("none")}</p>;
  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-lg border">
        {organizations.map((o) => (
          <li
            key={o.id}
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div>
              <Label htmlFor={`share-${o.id}`} className="font-medium">
                {o.name}
              </Label>
              <p className="text-sm text-muted-foreground">
                {o.shared ? t("shared") : t("notShared")}
              </p>
            </div>
            <Switch
              id={`share-${o.id}`}
              checked={o.shared}
              disabled={pending}
              onCheckedChange={(on) =>
                run(on ? "PUT" : "DELETE", `${base}/health-shares/${o.id}`)
              }
            />
          </li>
        ))}
      </ul>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
