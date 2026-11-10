"use client";

import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Badge } from "@wema/ui/components/ui/badge";
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
    return (
      <p className="rounded-card border border-dashed px-4 py-3 text-center text-sm text-muted-foreground">
        {t("none")}
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y overflow-hidden rounded-card border bg-background/60">
        {organizations.map((o) => (
          <li
            key={o.id}
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {o.name}
                <Badge variant={o.shared ? "success" : "neutral"}>
                  {o.shared ? t("sharedBadge") : t("notSharedBadge")}
                </Badge>
              </span>
              <p className="text-sm text-muted-foreground">
                {o.shared ? t("shared") : t("notShared")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor={`share-${o.id}`} className="font-normal">
                {t("toggle")}
              </Label>
              <Switch
                id={`share-${o.id}`}
                checked={o.shared}
                disabled={pending}
                onCheckedChange={(on) =>
                  run(on ? "PUT" : "DELETE", `${base}/health-shares/${o.id}`)
                }
              />
            </div>
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
