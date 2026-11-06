import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Card, CardContent } from "@wema/ui/components/ui/card";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
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
        <p className="text-muted-foreground">{t("assignments.empty")}</p>
      ) : (
        ORDER.map((status) => {
          const list = assignments
            .filter((a) => a.status === status)
            .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
          if (list.length === 0) return null;
          return (
            <section key={status} className="space-y-3">
              <h2 className="font-display text-xl font-bold">
                {t(`assignments.groups.${status}`)}
              </h2>
              <ul className="space-y-3">
                {list.map((a) => (
                  <li key={a.id}>
                    <Card>
                      <CardContent className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium">{a.title}</p>
                          <p className="text-sm text-muted-foreground">
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
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={status === "done" ? "default" : "outline"}
                          >
                            {t(`assignmentStatus.${status}`)}
                          </Badge>
                          {a.variantId && (
                            <Button
                              asChild
                              size="sm"
                              variant={
                                status === "todo" || status === "late"
                                  ? "default"
                                  : "outline"
                              }
                            >
                              <Link href={`/eleve/exercices/${a.variantId}`}>
                                {t("assignments.open")}
                              </Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}
