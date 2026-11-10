"use client";

import {
  CalendarPlus,
  Check,
  FunnelSimple,
  Plus,
  X,
} from "@phosphor-icons/react";
import { ILLUSTRATION_FOR } from "@wema/ui/components/illustrations/illustration";
import { Segmented } from "@wema/ui/components/patterns/segmented";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import {
  CARD_INNER_SHADOW,
  Card,
  CardShell,
} from "@wema/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@wema/ui/components/ui/dialog";
import { Label } from "@wema/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@wema/ui/components/ui/select";
import { toast } from "@wema/ui/components/ui/sonner";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { StepTrail } from "@wema/ui/components/wema/step-trail";
import { SubjectLabel } from "@wema/ui/components/wema/subject-icon";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { templatePreview } from "../../lib/statement-template";
import type { BankEntry, Exercise } from "../../lib/teacher-types";
import { useMutation } from "../../lib/use-mutation";
import { BankGenerate } from "./bank-generate";
import { PreviewDialog } from "./exercise-actions";
import { GiveAssignmentDialog, type GiveResult } from "./give-assignment";
import { SectionHeading } from "./section";
import { BankStatusBadge, KindBadge, SourceBadge } from "./status";

type Filter = "proposed" | "selected" | "rejected" | "all";
const FILTERS: Filter[] = ["proposed", "selected", "rejected", "all"];
const isFilter = (v: string): v is Filter => FILTERS.some((f) => f === v);

export interface BankNotion {
  name: string;
  context: string;
  /** Clé d'icône de la matière (`SubjectIcon`). */
  icon: string | null;
}

function Decision({ orgId, entry }: { orgId: string; entry: BankEntry }) {
  const t = useTranslations("teacher.bank");
  const { run, pending, error } = useMutation();
  async function decide(status: "selected" | "rejected") {
    const r = await run(
      "PATCH",
      `/admin/organizations/${orgId}/bank/${entry.id}`,
      { status },
    );
    if (r.ok)
      toast.success(
        status === "selected" ? t("selectedToast") : t("rejectedToast"),
      );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {entry.status !== "selected" && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => decide("selected")}
          className="hover:border-success-text/30 hover:bg-success-soft hover:text-success-text"
        >
          <Check />
          {t("select")}
        </Button>
      )}
      {entry.status !== "rejected" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => decide("rejected")}
        >
          <X />
          {t("reject")}
        </Button>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

/** Dépôt d'un exercice validé (de l'organisation ou de Wema) dans la banque. */
function AddDialog({
  orgId,
  week,
  candidates,
  notions,
}: {
  orgId: string;
  week: string;
  candidates: Exercise[];
  notions: Record<string, BankNotion>;
}) {
  const t = useTranslations("teacher.bank");
  const id = useId();
  const { run, pending, error, setError } = useMutation();
  const [open, setOpen] = useState(false);
  const [intentId, setIntentId] = useState("");
  const groups = new Map<string, Exercise[]>();
  for (const x of candidates) {
    const n = notions[x.notionId];
    const key = n ? `${n.name} · ${n.context}` : t("otherNotion");
    groups.set(key, [...(groups.get(key) ?? []), x]);
  }
  async function submit() {
    const r = await run("POST", `/admin/organizations/${orgId}/bank`, {
      week,
      intentId,
    });
    if (r.ok) {
      setOpen(false);
      setIntentId("");
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus />
          {t("add")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t("addDescription")}</DialogDescription>
        </DialogHeader>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noCandidate")}</p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-ex`}>{t("exercise")}</Label>
            <Select value={intentId} onValueChange={setIntentId}>
              <SelectTrigger
                id={`${id}-ex`}
                className="w-full whitespace-normal text-left"
              >
                <SelectValue placeholder={t("chooseExercise")} />
              </SelectTrigger>
              <SelectContent>
                {[...groups.entries()].map(([notion, list]) => (
                  <SelectGroup key={notion}>
                    <SelectLabel>{notion}</SelectLabel>
                    {list.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.objective}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {t("orCreate")}{" "}
          <Link
            className="font-medium text-foreground underline"
            href={`/prof/exercices/nouveau?org=${orgId}`}
          >
            {t("createLink")}
          </Link>
        </p>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button disabled={pending || !intentId} onClick={submit}>
            {t("addSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Banque hebdomadaire : propositions par notion, à retenir ou écarter. */
export function BankBoard({
  orgId,
  week,
  entries,
  exercises,
  notions,
  classes,
}: {
  orgId: string;
  week: string;
  entries: BankEntry[];
  exercises: Exercise[];
  notions: Record<string, BankNotion>;
  classes: { id: string; name: string }[];
}) {
  const t = useTranslations("teacher.bank");
  const tk = useTranslations("teacher.form.kinds");
  const proposed = entries.filter((e) => e.status === "proposed").length;
  const [filter, setFilter] = useState<Filter>(
    proposed > 0 ? "proposed" : "all",
  );
  const [result, setResult] = useState<GiveResult | null>(null);
  const byId = new Map(exercises.map((x) => [x.id, x]));
  const inBank = new Set(entries.map((e) => e.intentId));
  const candidates = exercises.filter(
    (x) => x.status === "validated" && !inBank.has(x.id),
  );
  const counts: Record<Filter, number> = {
    proposed,
    selected: entries.filter((e) => e.status === "selected").length,
    rejected: entries.filter((e) => e.status === "rejected").length,
    all: entries.length,
  };
  const shown = entries.filter((e) => filter === "all" || e.status === filter);
  const groups = new Map<string, BankEntry[]>();
  for (const e of shown)
    groups.set(e.notionId, [...(groups.get(e.notionId) ?? []), e]);
  const assignable = exercises
    .filter((x) => x.status === "validated")
    .map((x) => ({
      id: x.id,
      objective: x.objective,
      notionId: x.notionId,
      notionName: notions[x.notionId]
        ? `${notions[x.notionId]?.name} · ${notions[x.notionId]?.context}`
        : null,
    }));

  return (
    <div className="space-y-6">
      <CardShell>
        <StepTrail
          label={t("steps.label")}
          className={cn(
            "flex-1 rounded-card border bg-card p-4",
            CARD_INNER_SHADOW,
          )}
          steps={[
            {
              id: "propose",
              label: t("steps.propose"),
              description: t("how.step1"),
              state: entries.length > 0 ? "done" : "current",
            },
            {
              id: "sort",
              label: t("steps.sort"),
              description: t("how.step2"),
              state:
                entries.length === 0
                  ? "upcoming"
                  : proposed > 0
                    ? "current"
                    : "done",
            },
            {
              id: "give",
              label: t("steps.give"),
              description: t("how.step3"),
              state:
                entries.length > 0 && proposed === 0 ? "current" : "upcoming",
            },
          ]}
        />
      </CardShell>

      <BankGenerate orgId={orgId} week={week} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full overflow-x-auto">
          <Segmented
            name="bank-filter"
            legend={t("filter")}
            hideLegend
            size="sm"
            value={filter}
            onValueChange={(v) => isFilter(v) && setFilter(v)}
            options={FILTERS.map((f) => ({
              value: f,
              label: (
                <span className="inline-flex items-center gap-2">
                  {t(`filters.${f}`)}
                  <span className="rounded-full bg-background/70 px-1.5 font-mono text-[10px] tabular-nums">
                    {counts[f]}
                  </span>
                </span>
              ),
            }))}
          />
        </div>
        <AddDialog
          orgId={orgId}
          week={week}
          candidates={candidates}
          notions={notions}
        />
      </div>

      {result && (
        <Alert variant={result.failed > 0 ? "warning" : "success"}>
          <AlertDescription>
            {result.failed > 0
              ? t("givenPartial", {
                  created: result.created,
                  failed: result.failed,
                })
              : t("given", { created: result.created })}
          </AlertDescription>
        </Alert>
      )}

      {entries.length === 0 ? (
        <EmptyState
          illustration={ILLUSTRATION_FOR.emptyExercises}
          title={t("emptyTitle")}
          titleAs="h2"
          description={t("emptyHint")}
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<FunnelSimple weight="fill" />}
          tone="slate"
          title={t("emptyFilter")}
          titleAs="h2"
          description={t("emptyFilterHint")}
        />
      ) : (
        [...groups.entries()].map(([notionId, list]) => {
          const notion = notions[notionId];
          return (
            <section key={notionId} className="space-y-3">
              <SectionHeading
                eyebrow={notion?.context}
                title={
                  <SubjectLabel icon={notion?.icon} size={28}>
                    {notion?.name ?? t("otherNotion")}
                  </SubjectLabel>
                }
                actions={
                  <span className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                    {t("entries", { count: list.length })}
                  </span>
                }
              />
              <ul className="grid gap-3 lg:grid-cols-2">
                {list.map((e) => {
                  const x = byId.get(e.intentId);
                  return (
                    <li key={e.id} className="min-w-0">
                      <Card
                        tone={e.status === "selected" ? "mint" : "neutral"}
                        shellClassName={cn(
                          "h-full",
                          e.status === "rejected" && "opacity-70",
                        )}
                        className="h-full gap-4 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <BankStatusBadge status={e.status} />
                          {x && (
                            <>
                              <SourceBadge
                                source={
                                  x.organizationId === orgId ? x.source : "wema"
                                }
                              />
                              <KindBadge label={tk(x.task.kind)} />
                            </>
                          )}
                        </div>
                        <div className="space-y-2">
                          <p className="leading-snug font-medium">
                            {x?.objective ?? t("unknownExercise")}
                          </p>
                          {x && (
                            <p className="rounded-control bg-muted/60 px-3 py-2 font-math text-[15px] text-foreground/80">
                              {templatePreview(x.statement, x.task)}
                            </p>
                          )}
                        </div>
                        <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
                          <Decision orgId={orgId} entry={e} />
                          {x && (
                            <PreviewDialog
                              orgId={orgId}
                              exerciseId={x.id}
                              objective={x.objective}
                            />
                          )}
                          {x &&
                            e.status === "selected" &&
                            classes.length > 0 && (
                              <GiveAssignmentDialog
                                classes={classes}
                                exercises={assignable}
                                defaultIntentId={x.id}
                                onDone={setResult}
                                trigger={
                                  <Button size="sm" variant="ghost">
                                    <CalendarPlus />
                                    {t("give")}
                                  </Button>
                                }
                              />
                            )}
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
