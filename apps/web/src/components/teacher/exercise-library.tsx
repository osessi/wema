"use client";

import { MagnifyingGlass, PencilSimple, X } from "@phosphor-icons/react";
import { ILLUSTRATION_FOR } from "@wema/ui/components/illustrations/illustration";
import { Segmented } from "@wema/ui/components/patterns/segmented";
import { Button } from "@wema/ui/components/ui/button";
import { Card, CardShell } from "@wema/ui/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@wema/ui/components/ui/input-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@wema/ui/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import {
  SubjectIcon,
  SubjectLabel,
} from "@wema/ui/components/wema/subject-icon";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDeferredValue, useId, useState } from "react";
import { templatePreview } from "../../lib/statement-template";
import type { Exercise } from "../../lib/teacher-types";
import {
  ArchiveButton,
  PreviewDialog,
  ProposeButton,
  ValidateButton,
} from "./exercise-actions";
import { ExerciseStatusBadge, KindBadge, SourceBadge } from "./status";

type Filter = "all" | "draft" | "validated" | "archived" | "wema";
const FILTERS: Filter[] = ["all", "draft", "validated", "archived", "wema"];
const isFilter = (v: string): v is Filter => FILTERS.some((f) => f === v);

/** Texte comparable : minuscules, sans accents. */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

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
  notionNames: Record<
    string,
    { name: string; context: string; icon: string | null }
  >;
}) {
  const t = useTranslations("teacher.library");
  const tk = useTranslations("teacher.form.kinds");
  const id = useId();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [notion, setNotion] = useState("");
  const [kind, setKind] = useState("");
  const deferred = useDeferredValue(query);
  const own = (x: Exercise) => x.organizationId === orgId;
  const inFilter = (x: Exercise, f: Filter) =>
    f === "all"
      ? x.status !== "archived"
      : f === "wema"
        ? !own(x)
        : own(x) && x.status === f;
  const notionName = (x: Exercise) =>
    notionNames[x.notionId]?.name ?? t("unknownNotion");

  const needle = fold(deferred.trim());
  const matches = (x: Exercise) =>
    (notion === "" || x.notionId === notion) &&
    (kind === "" || x.task.kind === kind) &&
    (needle === "" ||
      fold(
        `${x.objective} ${templatePreview(x.statement, x.task)} ${notionName(x)}`,
      ).includes(needle));
  const shown = exercises
    .filter((x) => inFilter(x, filter) && matches(x))
    .sort(
      (a, b) =>
        notionName(a).localeCompare(notionName(b), "fr") ||
        a.objective.localeCompare(b.objective, "fr"),
    );
  const count = (f: Filter) =>
    exercises.filter((x) => inFilter(x, f) && matches(x)).length;

  const notionOptions = [
    ...new Map(exercises.map((x) => [x.notionId, notionName(x)])).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "fr"));
  const kindOptions = [...new Set(exercises.map((x) => x.task.kind))];
  const filtered = query !== "" || notion !== "" || kind !== "";
  const reset = () => {
    setQuery("");
    setNotion("");
    setKind("");
  };

  const actions = (x: Exercise) => (
    <div className="flex flex-wrap items-center gap-1">
      <PreviewDialog orgId={orgId} exerciseId={x.id} objective={x.objective} />
      {own(x) && (
        <Button asChild size="sm" variant="ghost">
          <Link href={`/prof/exercices/${x.id}?org=${orgId}`}>
            <PencilSimple />
            {t("edit")}
          </Link>
        </Button>
      )}
      {x.status === "validated" && (
        <ProposeButton orgId={orgId} exerciseId={x.id} week={week} />
      )}
      {own(x) && x.status !== "archived" && <ArchiveButton exerciseId={x.id} />}
      {own(x) && x.status === "draft" && <ValidateButton exerciseId={x.id} />}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_11rem]">
        <InputGroup>
          <InputGroupAddon>
            <MagnifyingGlass />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
          />
          {query !== "" && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={t("reset")}
                onClick={() => setQuery("")}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <div>
          <label htmlFor={`${id}-notion`} className="sr-only">
            {t("notionFilter")}
          </label>
          <NativeSelect
            id={`${id}-notion`}
            value={notion}
            onChange={(e) => setNotion(e.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="">{t("allNotions")}</NativeSelectOption>
            {notionOptions.map(([nid, name]) => (
              <NativeSelectOption key={nid} value={nid}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div>
          <label htmlFor={`${id}-kind`} className="sr-only">
            {t("kindFilter")}
          </label>
          <NativeSelect
            id={`${id}-kind`}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="">{t("allKinds")}</NativeSelectOption>
            {kindOptions.map((k) => (
              <NativeSelectOption key={k} value={k}>
                {tk(k)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full overflow-x-auto">
          <Segmented
            name="library-filter"
            legend={t("filter")}
            hideLegend
            size="sm"
            value={filter}
            onValueChange={(v) => isFilter(v) && setFilter(v)}
            options={FILTERS.map((f) => ({
              value: f,
              label: (
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  {t(`filters.${f}`)}
                  <span className="rounded-full bg-background/70 px-1.5 font-mono text-[10px] tabular-nums">
                    {count(f)}
                  </span>
                </span>
              ),
            }))}
          />
        </div>
        <p
          className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase"
          aria-live="polite"
        >
          {t("results", { count: shown.length })}
        </p>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          illustration={ILLUSTRATION_FOR.emptyExercises}
          title={t("empty")}
          titleAs="h2"
          description={t("emptyHint")}
          action={
            filtered ? (
              <Button variant="outline" size="sm" onClick={reset}>
                {t("reset")}
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link href={`/prof/exercices/nouveau?org=${orgId}`}>
                  {t("create")}
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 md:hidden">
            {shown.map((x) => (
              <li key={x.id} className="min-w-0">
                <Card className="gap-3 p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ExerciseStatusBadge status={x.status} />
                    <SourceBadge source={own(x) ? x.source : "wema"} />
                    <KindBadge label={tk(x.task.kind)} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <SubjectLabel
                      icon={notionNames[x.notionId]?.icon}
                      size={22}
                      className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase"
                    >
                      {notionName(x)}
                    </SubjectLabel>
                    <p className="leading-snug font-medium">{x.objective}</p>
                    <p className="font-math text-sm break-words text-muted-foreground">
                      {templatePreview(x.statement, x.task)}
                    </p>
                  </div>
                  <div className="border-t pt-2">{actions(x)}</div>
                </Card>
              </li>
            ))}
          </ul>
          <CardShell className="hidden md:flex">
            <div className="overflow-hidden rounded-card border bg-card shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">{t("exercise")}</TableHead>
                    <TableHead>{t("notion")}</TableHead>
                    <TableHead>{t("kind")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="pr-4">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((x) => (
                    <TableRow key={x.id} className="align-top">
                      <TableCell className="max-w-md space-y-1.5 py-3 pl-4 whitespace-normal">
                        <span className="block leading-snug font-medium">
                          {x.objective}
                        </span>
                        <span className="block font-math text-sm text-muted-foreground">
                          {templatePreview(x.statement, x.task)}
                        </span>
                        <SourceBadge source={own(x) ? x.source : "wema"} />
                      </TableCell>
                      <TableCell className="py-3 whitespace-normal">
                        <span className="flex items-start gap-2.5">
                          <SubjectIcon
                            icon={notionNames[x.notionId]?.icon}
                            size={28}
                          />
                          <span className="min-w-0">
                            {notionName(x)}
                            {notionNames[x.notionId]?.context && (
                              <span className="block text-xs text-muted-foreground">
                                {notionNames[x.notionId]?.context}
                              </span>
                            )}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <KindBadge label={tk(x.task.kind)} />
                      </TableCell>
                      <TableCell className="py-3">
                        <ExerciseStatusBadge status={x.status} />
                      </TableCell>
                      <TableCell className="py-3 pr-4 whitespace-normal">
                        {actions(x)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardShell>
        </>
      )}
    </div>
  );
}
