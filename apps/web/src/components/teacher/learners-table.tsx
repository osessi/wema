import { Button } from "@wema/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { ClassMap } from "../../lib/teacher-types";

/** Élèves d'une classe : synthèse par élève, lien vers la fiche. */
export function LearnersTable({
  map,
  orgId,
}: {
  map: ClassMap;
  orgId: string;
}) {
  const t = useTranslations("teacher.learners");
  const format = useFormatter();
  const now = new Date();
  if (map.learners.length === 0)
    return <p className="text-muted-foreground">{t("empty")}</p>;
  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("mastered")}</TableHead>
            <TableHead>{t("needsWork")}</TableHead>
            <TableHead>{t("misconceptions")}</TableHead>
            <TableHead>{t("lastActivity")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {map.learners.map((l) => {
            const statuses = Object.values(l.statuses);
            return (
              <TableRow key={l.userId}>
                <TableCell className="font-medium">{l.displayName}</TableCell>
                <TableCell>
                  {statuses.filter((s) => s === "mastered").length} /{" "}
                  {statuses.length}
                </TableCell>
                <TableCell>
                  {statuses.filter((s) => s === "needs_work").length}
                </TableCell>
                <TableCell>{l.activeMisconceptions}</TableCell>
                <TableCell className="text-muted-foreground">
                  {l.lastActivityAt
                    ? format.relativeTime(new Date(l.lastActivityAt), now)
                    : t("never")}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/prof/eleves/${orgId}/${l.userId}`}>
                      {t("open")}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
