import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../components/page-header";
import { getSchool } from "../../../../components/school/school-context";
import { load, serverApi } from "../../../../lib/api-server";

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { school, can } = await getSchool(orgId);
  if (!can("audit.read")) notFound();
  const t = await getTranslations("school.audit");
  const format = await getFormatter();
  const api = await serverApi();
  const { entries } = await load(
    api.admin.audit.$get({ query: { organizationId: orgId } }),
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={school.name} />
      {entries.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">
          {t("none")}
        </p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("at")}</TableHead>
                <TableHead>{t("actor")}</TableHead>
                <TableHead>{t("action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format.dateTime(new Date(e.at), {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell>{e.actorName ?? t("system")}</TableCell>
                  <TableCell>
                    {t.has(`actions.${e.action}`)
                      ? t(`actions.${e.action}`)
                      : e.action}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
