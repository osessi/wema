import { Badge } from "@wema/ui/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../components/page-header";
import { CreateClassForm } from "../../../../components/school/create-class-form";
import { loadPrograms } from "../../../../components/school/programs";
import { getSchool } from "../../../../components/school/school-context";
import { load, serverApi } from "../../../../lib/api-server";

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { school, can } = await getSchool(orgId);
  if (!can("classes.manage")) notFound();
  const t = await getTranslations("school.classes");
  const api = await serverApi();
  const [{ classes }, programs] = await Promise.all([
    load(api.admin.organizations[":id"].classes.$get({ param: { id: orgId } })),
    loadPrograms(),
  ]);
  const labels = new Map(programs.map((p) => [p.id, p.label]));
  const visible = classes.filter((k) => !k.archived);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={school.name} />
      {visible.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">
          {t("none")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((k) => (
            <Link
              key={k.id}
              href={`/ecole/${orgId}/classes/${k.id}`}
              className="rounded-xl"
            >
              <Card className="h-full transition-colors hover:bg-muted">
                <CardHeader>
                  <CardTitle className="font-display text-lg">
                    {k.name}
                  </CardTitle>
                  <CardDescription>
                    {k.programId ? (
                      (labels.get(k.programId) ?? t("unknownProgram"))
                    ) : (
                      <Badge variant="outline">{t("noProgram")}</Badge>
                    )}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-display text-xl font-bold">{t("new")}</h2>
        <CreateClassForm organizationId={orgId} programs={programs} />
      </section>
    </div>
  );
}
