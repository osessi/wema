import { ArrowRight, UsersThree } from "@phosphor-icons/react/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { CardShell } from "@wema/ui/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { PersonChip } from "@wema/ui/components/wema/person-avatar";
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
    return (
      <EmptyState
        icon={<UsersThree weight="fill" />}
        tone="sky"
        title={t("empty")}
      />
    );
  return (
    <CardShell tone="sky">
      <div className="overflow-hidden rounded-card border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">{t("name")}</TableHead>
              <TableHead className="text-right">{t("mastered")}</TableHead>
              <TableHead className="text-right">{t("needsWork")}</TableHead>
              <TableHead className="text-right">
                {t("misconceptions")}
              </TableHead>
              <TableHead>{t("lastActivity")}</TableHead>
              <TableHead className="pr-4">
                <span className="sr-only">{t("actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {map.learners.map((l) => {
              const statuses = Object.values(l.statuses);
              const mastered = statuses.filter((s) => s === "mastered").length;
              const needsWork = statuses.filter(
                (s) => s === "needs_work",
              ).length;
              return (
                <TableRow key={l.userId}>
                  <TableCell className="py-3 pl-4">
                    <PersonChip name={l.displayName} seed={l.userId} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="font-medium">{mastered}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      / {statuses.length}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={needsWork > 0 ? "warning" : "neutral"}
                      className="tabular-nums"
                    >
                      {needsWork}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={
                        l.activeMisconceptions > 0 ? "danger" : "neutral"
                      }
                      className="tabular-nums"
                    >
                      {l.activeMisconceptions}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.lastActivityAt
                      ? format.relativeTime(new Date(l.lastActivityAt), now)
                      : t("never")}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/prof/eleves/${orgId}/${l.userId}`}>
                        {t("open")}
                        <ArrowRight />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </CardShell>
  );
}
