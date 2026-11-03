"use client";

import { CalendarPlus, Check, Plus, Sparkle, X } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@wema/ui/components/ui/toggle-group";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { BankEntry, Exercise } from "../../lib/teacher-types";
import { useMutation } from "../../lib/use-mutation";
import { PreviewDialog } from "./exercise-actions";
import { GiveAssignmentDialog, type GiveResult } from "./give-assignment";

type Filter = "proposed" | "selected" | "rejected" | "all";
const FILTERS: Filter[] = ["proposed", "selected", "rejected", "all"];
const isFilter = (v: string): v is Filter => FILTERS.some((f) => f === v);

export interface BankNotion {
  name: string;
  context: string;
}

const STATUS_BADGE: Record<BankEntry["status"], string> = {
  proposed: "bg-muted text-muted-foreground",
  selected: "bg-primary text-primary-foreground",
  rejected: "border-border bg-transparent text-muted-foreground",
};

function Decision({ orgId, entry }: { orgId: string; entry: BankEntry }) {
  const t = useTranslations("teacher.bank");
  const { run, pending, error } = useMutation();
  const decide = (status: "selected" | "rejected") =>
    run("PATCH", `/admin/organizations/${orgId}/bank/${entry.id}`, { status });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {entry.status !== "selected" && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => decide("selected")}
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
        <Button>
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
      <ol className="grid gap-3 sm:grid-cols-3">
        {(["step1", "step2", "step3"] as const).map((s, i) => (
          <li key={s} className="flex gap-3 rounded-xl border bg-card p-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-display font-bold">
              {i + 1}
            </span>
            <span className="text-sm">{t(`how.${s}`)}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3">
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
              {t(`filters.${f}`)} ({counts[f]})
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <AddDialog
          orgId={orgId}
          week={week}
          candidates={candidates}
          notions={notions}
        />
      </div>

      {result && (
        <Alert>
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
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Sparkle className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 font-medium">{t("emptyTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground">{t("emptyFilter")}</p>
      ) : (
        [...groups.entries()].map(([notionId, list]) => {
          const notion = notions[notionId];
          return (
            <section key={notionId} className="space-y-3">
              <div>
                <h2 className="font-display text-xl font-bold">
                  {notion?.name ?? t("otherNotion")}
                </h2>
                {notion?.context && (
                  <p className="text-sm text-muted-foreground">
                    {notion.context}
                  </p>
                )}
              </div>
              <ul className="grid gap-3 lg:grid-cols-2">
                {list.map((e) => {
                  const x = byId.get(e.intentId);
                  return (
                    <li
                      key={e.id}
                      className={cn(
                        "flex flex-col gap-3 rounded-xl border bg-card p-4",
                        e.status === "rejected" && "opacity-70",
                        e.status === "selected" && "border-foreground/40",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={STATUS_BADGE[e.status]}>
                          {t(`status.${e.status}`)}
                        </Badge>
                        {x && (
                          <>
                            <Badge variant="outline">
                              {x.organizationId === orgId
                                ? t(`source.${x.source}`)
                                : t("source.wema")}
                            </Badge>
                            <Badge variant="outline">{tk(x.task.kind)}</Badge>
                          </>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {x?.objective ?? t("unknownExercise")}
                        </p>
                        {x && (
                          <p className="text-sm text-muted-foreground">
                            {x.statement}
                          </p>
                        )}
                      </div>
                      <div className="mt-auto flex flex-wrap items-center gap-2">
                        <Decision orgId={orgId} entry={e} />
                        {x && (
                          <PreviewDialog
                            orgId={orgId}
                            exerciseId={x.id}
                            objective={x.objective}
                          />
                        )}
                        {x && e.status === "selected" && classes.length > 0 && (
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
