import {
  ArrowRight,
  ChatsCircle,
  CheckCircle,
  Lifebuoy,
  Question,
  Wrench,
} from "@phosphor-icons/react/ssr";
import { GlowTile, TsfFrame } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@wema/ui/components/ui/card";
import { NotionStatus } from "@wema/ui/components/wema/notion-status";
import { StatTile } from "@wema/ui/components/wema/stat-tile";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type {
  PlacementLevel,
  PlacementResult as Result,
} from "../../lib/placement-types";

const GROUPS: {
  level: PlacementLevel;
  tone: "mint" | "amber" | "rose" | "slate";
  shell: "mint" | "amber" | "rose" | "neutral";
  icon: ReactNode;
}[] = [
  {
    level: "to_review",
    tone: "rose",
    shell: "rose",
    icon: <Wrench weight="bold" />,
  },
  {
    level: "to_consolidate",
    tone: "amber",
    shell: "amber",
    icon: <Lifebuoy weight="bold" />,
  },
  {
    level: "acquired",
    tone: "mint",
    shell: "mint",
    icon: <CheckCircle weight="fill" />,
  },
  {
    level: "not_assessed",
    tone: "slate",
    shell: "neutral",
    icon: <Question weight="bold" />,
  },
];

/**
 * Bilan du test de niveau : les notions à reprendre, à consolider et
 * acquises, avec leur statut dans le profil et, pour une estimation déduite
 * du graphe des prérequis, les notions interrogées qui la fondent.
 */
export function PlacementResult({ result }: { result: Result }) {
  const t = useTranslations("learner.placement");
  const ts = useTranslations("learner.status");
  return (
    <div className="space-y-6">
      <ul className="grid gap-3 sm:grid-cols-3">
        {GROUPS.filter((g) => g.level !== "not_assessed").map((g) => (
          <li key={g.level} className="min-w-0">
            <StatTile
              label={t(`groups.${g.level}`)}
              value={result.notions.filter((n) => n.level === g.level).length}
              icon={g.icon}
              tone={g.tone}
              className="h-full"
            />
          </li>
        ))}
      </ul>
      {GROUPS.map(({ level, tone, shell, icon }) => {
        const notions = result.notions.filter((n) => n.level === level);
        if (level === "not_assessed" && notions.length === 0) return null;
        return (
          <Card key={level} tone={shell} className="gap-4">
            <section
              aria-labelledby={`placement-${level}`}
              className="contents"
            >
              <CardHeader className="flex items-center gap-3">
                <GlowTile tone={tone} size={36}>
                  {icon}
                </GlowTile>
                <div className="min-w-0">
                  <h2
                    id={`placement-${level}`}
                    className="text-lg font-medium tracking-tight"
                  >
                    {t(`groups.${level}`)}{" "}
                    <span className="text-muted-foreground tabular-nums">
                      ({notions.length})
                    </span>
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t(`groupHints.${level}`)}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {notions.length === 0 ? (
                  <p className="rounded-card border border-dashed p-3 text-sm text-muted-foreground">
                    {t("groupEmpty")}
                  </p>
                ) : (
                  <ul className="divide-y">
                    {notions.map((n) => (
                      <li
                        key={n.notionId}
                        className="space-y-1.5 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{n.name}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {!n.inProgram && (
                              <Badge variant="neutral">
                                {t("prerequisite")}
                              </Badge>
                            )}
                            <span className="sr-only">
                              {t("profileStatus")}
                            </span>
                            <NotionStatus
                              status={n.status}
                              label={ts(n.status)}
                              size="sm"
                            />
                          </div>
                        </div>
                        {n.source === "inferred" && (
                          <p className="text-sm text-muted-foreground">
                            {t("inferred", {
                              notions: n.evidence.map((e) => e.name).join(", "),
                            })}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </section>
          </Card>
        );
      })}

      <TsfFrame innerClassName="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <GlowTile tone="yellow" size={56} idle="breathe">
            <ChatsCircle weight="fill" />
          </GlowTile>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xl font-medium tracking-tight">
              {t("nextTitle")}
            </p>
            <p className="text-muted-foreground">{t("nextText")}</p>
          </div>
          <Button
            asChild
            variant="brand"
            size="lg"
            className="h-auto w-full py-2.5 whitespace-normal sm:w-auto"
          >
            <Link href="/eleve/prof-ia?mode=intake">
              {t("meetTutor")}
              <ArrowRight aria-hidden weight="bold" />
            </Link>
          </Button>
        </div>
      </TsfFrame>
    </div>
  );
}
