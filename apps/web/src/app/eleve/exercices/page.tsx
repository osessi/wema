import {
  ArrowRight,
  CheckCircle,
  Footprints,
  PencilSimpleLine,
} from "@phosphor-icons/react/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Card, type CardTone } from "@wema/ui/components/ui/card";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { LevelMeter } from "../../../components/learner/level-meter";
import { MathText } from "../../../components/learner/math";
import { AssignmentBadge } from "../../../components/learner/visuals";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import type { Variant } from "../../../lib/learner-types";

/** Teinte de la coque d'un exercice, selon le statut du devoir. */
const SHELL: Record<string, CardTone> = {
  todo: "brand",
  late: "rose",
  done: "mint",
  attempted: "sky",
  unavailable: "neutral",
};

export default async function Page() {
  const t = await getTranslations("learner");
  const format = await getFormatter();
  const api = await serverApi();
  const [{ variants }, { assignments }] = await Promise.all([
    load(api.learner.variants.$get()),
    load(api.learner.assignments.$get()),
  ]);
  const assignmentOf = new Map(
    assignments.flatMap((a) => (a.variantId ? [[a.variantId, a]] : [])),
  );
  // À faire d'abord, réussis ensuite : on ne propose pas de refaire ce qui est acquis.
  const isDone = (v: Variant) => assignmentOf.get(v.id)?.status === "done";
  const groups = [
    {
      key: "todo",
      title: t("exercises.groupTodo"),
      items: variants.filter((v) => !isDone(v)),
    },
    {
      key: "done",
      title: t("exercises.groupDone"),
      items: variants.filter(isDone),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader
        title={t("exercises.title")}
        description={t("exercises.description")}
      />
      {variants.length === 0 ? (
        <EmptyState
          icon={<PencilSimpleLine weight="fill" />}
          tone="mint"
          title={t("exercises.empty")}
          titleAs="h2"
          action={
            <Button asChild variant="outline">
              <Link href="/eleve/prof-ia">{t("tutor.newSession")}</Link>
            </Button>
          }
        />
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-3">
            <h2 className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {group.title} ·{" "}
              <span className="tabular-nums">{group.items.length}</span>
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {group.items.map((v) => {
                const assignment = assignmentOf.get(v.id);
                const done = assignment?.status === "done";
                return (
                  <li key={v.id}>
                    <Card
                      tone={
                        (assignment && SHELL[assignment.status]) || "neutral"
                      }
                      className="h-full gap-3 p-4 sm:p-5"
                    >
                      <article className="contents">
                        <div className="flex flex-wrap items-center gap-2">
                          {assignment && (
                            <AssignmentBadge
                              status={assignment.status}
                              label={t(`assignmentStatus.${assignment.status}`)}
                            />
                          )}
                          <LevelMeter
                            level={v.level}
                            label={t("exercises.levelOf", { level: v.level })}
                          />
                          {v.scaffolded && (
                            <Badge variant="info">
                              <Footprints aria-hidden weight="bold" />
                              {t("exercises.guided")}
                            </Badge>
                          )}
                        </div>
                        {assignment && (
                          <h3 className="line-clamp-2 font-medium">
                            {assignment.title}
                          </h3>
                        )}
                        <p className="line-clamp-3 text-sm text-muted-foreground">
                          <MathText text={v.statement} rendered={v.rendered} />
                        </p>
                        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {assignment && !done
                              ? t("common.dueOn", {
                                  date: format.dateTime(
                                    new Date(assignment.dueAt),
                                    {
                                      day: "numeric",
                                      month: "long",
                                    },
                                  ),
                                })
                              : null}
                          </span>
                          <Button
                            asChild
                            size="sm"
                            variant={done ? "outline" : "default"}
                          >
                            <Link href={`/eleve/exercices/${v.id}`}>
                              {done ? (
                                <CheckCircle aria-hidden weight="bold" />
                              ) : null}
                              {done
                                ? t("exercises.review")
                                : t("exercises.open")}
                              {done ? null : <ArrowRight aria-hidden />}
                            </Link>
                          </Button>
                        </div>
                      </article>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
