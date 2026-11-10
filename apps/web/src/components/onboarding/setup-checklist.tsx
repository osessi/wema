"use client";

import {
  ArrowRight,
  CheckCircle,
  Circle,
  RocketLaunch,
} from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/components/brand/glow-tile";
import { Button } from "@wema/ui/components/ui/button";
import { Progress } from "@wema/ui/components/ui/progress";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

export const CHECKLIST_ITEMS = [
  "family",
  "child",
  "program",
  "placement",
  "subscription",
  "diagnostic",
] as const;
export type ChecklistItem = (typeof CHECKLIST_ITEMS)[number];

const STORAGE_KEY = "wema.setup-checklist.hidden";

/**
 * Liste de démarrage du parent : les étapes du parcours guidé, faites ou
 * restantes, avec la progression. On peut la masquer une fois tout fait
 * (préférence de cet appareil seulement).
 */
export function SetupChecklist({
  items,
}: {
  items: { key: ChecklistItem; done: boolean; href: string }[];
}) {
  const t = useTranslations("onboarding.checklist");
  const id = useId();
  const [hidden, setHidden] = useState(false);
  const done = items.filter((i) => i.done).length;
  const complete = done === items.length;

  useEffect(() => {
    try {
      if (complete && window.localStorage.getItem(STORAGE_KEY) === "1")
        setHidden(true);
    } catch {
      // Stockage indisponible : la liste reste affichée.
    }
  }, [complete]);

  if (hidden) return null;
  const nextItem = items.find((i) => !i.done);

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-4 rounded-card border bg-card p-4 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <GlowTile tone="yellow" size={40}>
          <RocketLaunch weight="fill" />
        </GlowTile>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="text-lg font-medium tracking-tight">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground" id={`${id}-progress`}>
            {complete
              ? t("allDone")
              : t("progress", { done, total: items.length })}
          </p>
        </div>
        {complete ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setHidden(true);
              try {
                window.localStorage.setItem(STORAGE_KEY, "1");
              } catch {
                // Sans stockage, la liste reviendra au prochain chargement.
              }
            }}
          >
            {t("hide")}
          </Button>
        ) : nextItem ? (
          <Button asChild variant="brand" size="sm">
            <Link href={nextItem.href}>
              {t("resume")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
      <Progress
        value={Math.round((done / items.length) * 100)}
        aria-label={t("progressLabel")}
        aria-describedby={`${id}-progress`}
      />
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm transition-colors hover:bg-muted",
                item.done && "text-muted-foreground",
              )}
            >
              {item.done ? (
                <CheckCircle
                  weight="fill"
                  className="size-5 shrink-0 text-success-text"
                  aria-hidden
                />
              ) : (
                <Circle className="size-5 shrink-0" aria-hidden />
              )}
              <span className={cn(item.done && "line-through")}>
                {t(`items.${item.key}`)}
              </span>
              <span className="sr-only">
                {` (${item.done ? t("done") : t("todo")})`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
