"use client";

import { ArrowRight } from "@phosphor-icons/react";
import {
  SetupChecklist as Checklist,
  type SetupStatus,
} from "@wema/ui/components/patterns/index";
import { Button } from "@wema/ui/components/ui/button";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

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
 * Liste de démarrage du parent (motif `SetupChecklist` de la vitrine) : les
 * étapes du parcours guidé, faites ou restantes, avec la progression. On peut
 * la masquer une fois tout fait (préférence de cet appareil seulement).
 */
export function SetupChecklist({
  items,
}: {
  items: { key: ChecklistItem; done: boolean; href: string }[];
}) {
  const t = useTranslations("onboarding.checklist");
  const [hidden, setHidden] = useState(false);
  const complete = items.every((i) => i.done);

  useEffect(() => {
    try {
      if (complete && window.localStorage.getItem(STORAGE_KEY) === "1")
        setHidden(true);
    } catch {
      // Stockage indisponible : la liste reste affichée.
    }
  }, [complete]);

  if (hidden) return null;
  const next = items.find((i) => !i.done);

  return (
    <Checklist
      title={t("title")}
      description={complete ? t("allDone") : undefined}
      labels={{
        count: (done, total) => t("progress", { done, total }),
        progress: t("progressLabel"),
        status: { done: t("done"), current: t("todo"), pending: t("todo") },
      }}
      items={items.map((item) => {
        const status: SetupStatus = item.done
          ? "done"
          : item === next
            ? "current"
            : "pending";
        return {
          id: item.key,
          status,
          label: item.done ? (
            t(`items.${item.key}`)
          ) : (
            <Link
              href={item.href}
              className="underline-offset-4 hover:underline focus-visible:underline"
            >
              {t(`items.${item.key}`)}
            </Link>
          ),
        };
      })}
      action={
        complete ? (
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
        ) : next ? (
          <Button asChild variant="brand" size="sm">
            <Link href={next.href}>
              {t("resume")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null
      }
    />
  );
}
