"use client";

import { PencilSimple } from "@phosphor-icons/react";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@wema/ui/components/ui/toggle-group";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { templatePreview } from "../../lib/statement-template";
import type { Exercise } from "../../lib/teacher-types";
import {
  ArchiveButton,
  PreviewDialog,
  ProposeButton,
  ValidateButton,
} from "./exercise-actions";
import { ExerciseStatusBadge } from "./status";

type Filter = "all" | "draft" | "validated" | "archived" | "wema";
const FILTERS: Filter[] = ["all", "draft", "validated", "archived", "wema"];
const isFilter = (v: string): v is Filter => FILTERS.some((f) => f === v);

/** Bibliothèque : exercices de l'organisation et exercices validés de Wema. */
export function ExerciseLibrary({
  orgId,
  week,
  exercises,
  notionNames,
}: {
  orgId: string;
  week: string;
  exercises: Exercise[];
  notionNames: Record<string, { name: string; context: string }>;
}) {
  const t = useTranslations("teacher.library");
  const tk = useTranslations("teacher.form.kinds");
  const [filter, setFilter] = useState<Filter>("all");
  const own = (x: Exercise) => x.organizationId === orgId;
  const shown = exercises.filter((x) =>
    filter === "all"
      ? x.status !== "archived"
      : filter === "wema"
        ? !own(x)
        : own(x) && x.status === filter,
  );
  const count = (f: Filter) =>
    exercises.filter((x) =>
      f === "all"
        ? x.status !== "archived"
        : f === "wema"
          ? !own(x)
          : own(x) && x.status === f,
    ).length;

  return (
    <div className="space-y-4">
      <ToggleGroup
        type="single"
        variant="outline"
        value={filter}
        onValueChange={(v) => isFilter(v) && setFilter(v)}
        aria-label={t("filter")}
        className="flex-wrap"
      >
        {FILTERS.map((f) => (
          <ToggleGroupItem key={f} value={f} className="px-3">
            {t(`filters.${f}`)} ({count(f)})
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {shown.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("exercise")}</TableHead>
                <TableHead>{t("notion")}</TableHead>
                <TableHead>{t("kind")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((x) => (
                <TableRow key={x.id} className="align-top">
                  <TableCell className="max-w-md whitespace-normal">
                    <span className="font-medium">{x.objective}</span>
                    <span className="block text-xs text-muted-foreground">
                      {templatePreview(x.statement, x.task)}
                    </span>
                    <Badge variant="outline" className="mt-1">
                      {own(x) ? t(`source.${x.source}`) : t("source.wema")}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {notionNames[x.notionId]?.name ?? t("unknownNotion")}
                    {notionNames[x.notionId]?.context && (
                      <span className="block text-xs text-muted-foreground">
                        {notionNames[x.notionId]?.context}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{tk(x.task.kind)}</TableCell>
                  <TableCell>
                    <ExerciseStatusBadge status={x.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-start gap-1">
                      <PreviewDialog
                        orgId={orgId}
                        exerciseId={x.id}
                        objective={x.objective}
                      />
                      {own(x) && (
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/prof/exercices/${x.id}?org=${orgId}`}>
                            <PencilSimple />
                            {t("edit")}
                          </Link>
                        </Button>
                      )}
                      {x.status === "validated" && (
                        <ProposeButton
                          orgId={orgId}
                          exerciseId={x.id}
                          week={week}
                        />
                      )}
                      {own(x) && x.status !== "archived" && (
                        <ArchiveButton exerciseId={x.id} />
                      )}
                      {own(x) && x.status === "draft" && (
                        <ValidateButton exerciseId={x.id} />
                      )}
                    </div>
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
