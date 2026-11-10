import { Card, CardContent } from "@wema/ui/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { EmptyState } from "../_ui/fields";

export default async function AuditPage() {
  const t = await getTranslations("audit");
  const format = await getFormatter();
  const api = await serverApi();
  const { entries } = await load(api.admin.audit.$get({ query: {} }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {entries.length === 0 ? (
        <EmptyState>{t("none")}</EmptyState>
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("when")}</TableHead>
                  <TableHead>{t("who")}</TableHead>
                  <TableHead>{t("action")}</TableHead>
                  <TableHead>{t("target")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id} className="align-top">
                    <TableCell className="whitespace-nowrap">
                      {format.dateTime(new Date(e.at), {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })}
                    </TableCell>
                    <TableCell>{e.actorName ?? t("system")}</TableCell>
                    <TableCell>
                      {t.has(`actions.${e.action}`) ? (
                        <span title={e.action}>{t(`actions.${e.action}`)}</span>
                      ) : (
                        <code className="text-xs">{e.action}</code>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.has(`targets.${e.targetType}`)
                        ? t(`targets.${e.targetType}`)
                        : e.targetType}
                      {e.targetId ? (
                        <span title={e.targetId}>
                          {" "}
                          · {e.targetId.slice(0, 8)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {Object.keys(e.details).length > 0 ? (
                        <details>
                          <summary className="cursor-pointer text-sm">
                            {t("details")}
                          </summary>
                          <dl className="mt-1.5 grid max-w-[420px] gap-1 text-xs">
                            {Object.entries(e.details).map(([k, v]) => (
                              <div key={k} className="flex flex-wrap gap-1.5">
                                <dt className="text-muted-foreground">{k}</dt>
                                <dd className="break-all">
                                  {typeof v === "string" ||
                                  typeof v === "number" ||
                                  typeof v === "boolean"
                                    ? String(v)
                                    : JSON.stringify(v)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
