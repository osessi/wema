import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Card, CardContent } from "@wema/ui/components/ui/card";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MathText } from "../../../components/learner/math";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";

export default async function Page() {
  const t = await getTranslations("learner");
  const api = await serverApi();
  const [{ variants }, { assignments }] = await Promise.all([
    load(api.learner.variants.$get()),
    load(api.learner.assignments.$get()),
  ]);
  const assignmentOf = new Map(
    assignments.flatMap((a) => (a.variantId ? [[a.variantId, a]] : [])),
  );

  return (
    <>
      <PageHeader
        title={t("exercises.title")}
        description={t("exercises.description")}
      />
      {variants.length === 0 ? (
        <p className="text-muted-foreground">{t("exercises.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {variants.map((v) => {
            const assignment = assignmentOf.get(v.id);
            return (
              <li key={v.id}>
                <Card>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {assignment && (
                        <Badge variant="outline">
                          {t("exercises.fromAssignment", {
                            title: assignment.title,
                          })}
                        </Badge>
                      )}
                      {assignment && (
                        <Badge
                          variant={
                            assignment.status === "done" ? "default" : "outline"
                          }
                        >
                          {t(`assignmentStatus.${assignment.status}`)}
                        </Badge>
                      )}
                      <Badge variant="secondary">
                        {t("exercises.level", { level: v.level })}
                      </Badge>
                      {v.scaffolded && (
                        <Badge variant="secondary">
                          {t("exercises.guided")}
                        </Badge>
                      )}
                    </div>
                    <p className="line-clamp-3">
                      <MathText text={v.statement} rendered={v.rendered} />
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/eleve/exercices/${v.id}`}>
                        {t("exercises.open")}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
