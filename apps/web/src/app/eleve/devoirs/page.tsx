import {
  ArrowRight,
  CheckCircle,
  ClipboardText,
  Clock,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import { Button } from "@wema/ui/components/ui/button";
import { Card, CardContent, type CardTone } from "@wema/ui/components/ui/card";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { StatTile } from "@wema/ui/components/wema/stat-tile";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { AssignmentBadge } from "../../../components/learner/visuals";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import type { AssignmentStatus } from "../../../lib/learner-types";

const ORDER: AssignmentStatus[] = [
  "late",
  "todo",
  "attempted",
  "done",
  "unavailable",
];

/** Teinte de la coque de chaque groupe, selon son statut. */
const SHELL: Record<string, CardTone> = {
  late: "rose",
  todo: "amber",
  attempted: "sky",
  done: "mint",
  unavailable: "neutral",
};

export default async function Page() {
  const t = await getTranslations("learner");
  const format = await getFormatter();
  const api = await serverApi();
  const { assignments } = await load(api.learner.assignments.$get());

  return (
    <>
      <PageHeader
        title={t("assignments.title")}
        description={t("assignments.description")}
      />
      {assignments.length === 0 ? (
        <EmptyState
          icon={<ClipboardText weight="fill" />}
          tone="amber"
          title={t("assignments.empty")}
          titleAs="h2"
          description={t("home.noUpcomingHint")}
          action={
            <Button asChild variant="outline">
              <Link href="/eleve/exercices">{t("exercises.toList")}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-3">
            {(
              [
                {
                  status: "late",
                  icon: <WarningCircle weight="fill" />,
                  tone: "rose",
                },
                {
                  status: "todo",
                  icon: <Clock weight="fill" />,
                  tone: "amber",
                },
                {
                  status: "done",
                  icon: <CheckCircle weight="fill" />,
                  tone: "mint",
                },
              ] as const
            ).map(({ status, icon, tone }) => (
              <li key={status} className="min-w-0">
                <StatTile
                  label={t(`assignments.groups.${status}`)}
                  value={assignments.filter((a) => a.status === status).length}
                  icon={icon}
                  tone={tone}
                  className="h-full"
                />
              </li>
            ))}
          </ul>
          {ORDER.map((status) => {
            const list = assignments
              .filter((a) => a.status === status)
              .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
            if (list.length === 0) return null;
            const urgent = status === "todo" || status === "late";
            return (
              <section key={status} className="space-y-3">
                <h2 className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  {t(`assignments.groups.${status}`)} ·{" "}
                  <span className="tabular-nums">{list.length}</span>
                </h2>
                <Card tone={SHELL[status] ?? "neutral"} className="py-2">
                  <CardContent className="px-4 sm:px-5">
                    <ul className="divide-y">
                      {list.map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-medium">{a.title}</p>
                            <p className="text-sm text-muted-foreground tabular-nums">
                              {t("common.dueOn", {
                                date: format.dateTime(new Date(a.dueAt), {
                                  dateStyle: "long",
                                  timeStyle: "short",
                                }),
                              })}
                            </p>
                            {status === "unavailable" && (
                              <p className="text-sm text-muted-foreground">
                                {t("assignments.unavailableHint")}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3 sm:justify-end">
                            <AssignmentBadge
                              status={status}
                              label={t(`assignmentStatus.${status}`)}
                            />
                            {a.variantId && (
                              <Button
                                asChild
                                size="sm"
                                variant={urgent ? "default" : "outline"}
                              >
                                <Link href={`/eleve/exercices/${a.variantId}`}>
                                  {status === "done"
                                    ? t("exercises.review")
                                    : t("assignments.open")}
                                  {urgent && <ArrowRight aria-hidden />}
                                </Link>
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}
