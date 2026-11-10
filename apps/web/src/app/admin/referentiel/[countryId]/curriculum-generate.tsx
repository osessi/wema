"use client";

import {
  ArrowDown,
  ArrowUp,
  MagicWand,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Card } from "@wema/ui/components/ui/card";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import { Textarea } from "@wema/ui/components/ui/textarea";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
import { cn } from "@wema/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { browserApi } from "../../../../lib/insights-client";
import type { ImportPreview } from "../../../../lib/insights-types";
import { read } from "../../../../lib/mutate";
import { SelectField, TextAreaField } from "../../_ui/fields";
import { Panel } from "../../_ui/kit";
import { issuesOf, SummaryList, useIssueText } from "./curriculum-transfer";

/** Taille maximale du texte envoyé (MAX_SOURCE_CHARS de @wema/curriculum). */
const MAX_SOURCE = 60_000;

interface DraftNotion {
  key: number;
  code: string;
  name: string;
  objective: string;
  prerequisites: string;
}
interface DraftUnit {
  key: number;
  name: string;
  notions: DraftNotion[];
}
type Issue = Record<string, unknown>;

let nextKey = 0;
const keyed = () => ++nextKey;

function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  if (item !== undefined) copy.splice(target, 0, item);
  return copy;
}

function toProposal(units: DraftUnit[]) {
  return {
    units: units.map((u) => ({
      name: u.name,
      notions: u.notions.map((n) => ({
        code: n.code.trim(),
        name: n.name,
        objective: n.objective,
        prerequisites: n.prerequisites
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
      })),
    })),
  };
}

function useProposalIssueText() {
  const t = useTranslations("reports.generate.issue");
  const transfer = useIssueText();
  return (i: Issue) => {
    const s = (k: string) => {
      const v = i[k];
      return typeof v === "string" || typeof v === "number" ? String(v) : "";
    };
    switch (i.kind) {
      case "schema":
        return t("schema", { message: s("message") });
      case "too_many_notions":
        return t("too_many_notions", { max: s("max") });
      case "duplicate_code":
        return t("duplicate_code", { code: s("code") });
      case "unknown_prerequisite":
        if ("prerequisite" in i)
          return t("unknown_prerequisite", {
            code: s("code"),
            prerequisite: s("prerequisite"),
          });
        return transfer(i);
      default:
        return transfer(i);
    }
  };
}

function MoveButtons({
  index,
  count,
  onMove,
  label,
}: {
  index: number;
  count: number;
  onMove: (delta: number) => void;
  label: string;
}) {
  const t = useTranslations("reports.generate");
  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={index === 0}
        aria-label={t("moveUp", { item: label })}
        onClick={() => onMove(-1)}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={index === count - 1}
        aria-label={t("moveDown", { item: label })}
        onClick={() => onMove(1)}
      >
        <ArrowDown aria-hidden />
      </Button>
    </>
  );
}

function Review({
  units,
  setUnits,
  existing,
}: {
  units: DraftUnit[];
  setUnits: (u: DraftUnit[]) => void;
  existing: ReadonlySet<string>;
}) {
  const t = useTranslations("reports.generate");
  const tc = useTranslations("curriculum");
  const base = useId();
  const updateUnit = (ui: number, patch: Partial<DraftUnit>) =>
    setUnits(units.map((u, i) => (i === ui ? { ...u, ...patch } : u)));
  const updateNotion = (ui: number, ni: number, patch: Partial<DraftNotion>) =>
    updateUnit(ui, {
      notions: (units[ui]?.notions ?? []).map((n, i) =>
        i === ni ? { ...n, ...patch } : n,
      ),
    });

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <ol className="space-y-4" aria-label={t("reviewTitle")}>
      {units.map((u, ui) => (
        <li key={u.key}>
          <Card variant="flat" className="gap-0 overflow-hidden py-0">
            <div className="flex flex-wrap items-end gap-3 border-b bg-muted/40 p-3 sm:p-4">
              <span
                aria-hidden
                className="grid h-9 min-w-9 place-items-center rounded-[10px] bg-foreground px-2 font-mono text-xs font-medium text-background"
              >
                {pad(ui + 1)}
              </span>
              <div className="grid min-w-[min(100%,12rem)] flex-1 gap-1.5">
                <Label htmlFor={`${base}-u${u.key}`}>
                  {t("unit", { n: ui + 1 })}
                </Label>
                <Input
                  id={`${base}-u${u.key}`}
                  className="bg-card font-medium"
                  value={u.name}
                  onChange={(e) => updateUnit(ui, { name: e.target.value })}
                />
              </div>
              <span className="flex items-center gap-1">
                <Badge variant="neutral" className="mr-1 tabular-nums">
                  {tc("notionsCount", { count: u.notions.length })}
                </Badge>
                <MoveButtons
                  index={ui}
                  count={units.length}
                  label={u.name}
                  onMove={(d) => setUnits(move(units, ui, d))}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("removeUnit", { item: u.name })}
                  onClick={() => setUnits(units.filter((_, i) => i !== ui))}
                >
                  <Trash aria-hidden />
                </Button>
              </span>
            </div>
            <ol className="space-y-3 p-3 sm:p-4">
              {u.notions.map((n, ni) => {
                const id = `${base}-n${n.key}`;
                const known = existing.has(n.code.trim());
                return (
                  <li
                    key={n.key}
                    data-testid="proposal-notion"
                    className={cn(
                      "grid gap-3 rounded-[12px] border border-l-[3px] bg-card p-3 shadow-xs sm:p-4",
                      known
                        ? "border-l-[var(--glow-sky-a)]"
                        : "border-l-[var(--glow-amber-a)]",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        aria-hidden
                        className="font-mono text-[11px] font-medium tracking-[0.06em] text-muted-foreground"
                      >
                        {pad(ui + 1)}.{pad(ni + 1)}
                      </span>
                      <Badge variant="warning">{t("toValidate")}</Badge>
                      {known && <Badge variant="info">{t("existing")}</Badge>}
                      <span className="ml-auto flex gap-1">
                        <MoveButtons
                          index={ni}
                          count={u.notions.length}
                          label={n.name}
                          onMove={(d) =>
                            updateUnit(ui, { notions: move(u.notions, ni, d) })
                          }
                        />
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t("removeNotion", { item: n.name })}
                          onClick={() =>
                            updateUnit(ui, {
                              notions: u.notions.filter((_, i) => i !== ni),
                            })
                          }
                        >
                          <Trash aria-hidden />
                        </Button>
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
                      <div className="grid gap-1.5">
                        <Label htmlFor={`${id}-code`}>{t("code")}</Label>
                        <Input
                          id={`${id}-code`}
                          className="font-mono"
                          value={n.code}
                          onChange={(e) =>
                            updateNotion(ui, ni, { code: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor={`${id}-name`}>{t("name")}</Label>
                        <Input
                          id={`${id}-name`}
                          value={n.name}
                          onChange={(e) =>
                            updateNotion(ui, ni, { name: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`${id}-objective`}>
                        {t("objective")}
                      </Label>
                      <Textarea
                        id={`${id}-objective`}
                        rows={2}
                        value={n.objective}
                        onChange={(e) =>
                          updateNotion(ui, ni, { objective: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`${id}-pre`}>{t("prerequisites")}</Label>
                      <Input
                        id={`${id}-pre`}
                        className="font-mono"
                        placeholder={t("prerequisitesHint")}
                        value={n.prerequisites}
                        onChange={(e) =>
                          updateNotion(ui, ni, {
                            prerequisites: e.target.value,
                          })
                        }
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </li>
      ))}
    </ol>
  );
}

/**
 * Programme proposé par l'IA à partir du texte officiel : l'admin choisit
 * la classe et la matière, colle le texte ou téléverse un PDF, relit la
 * proposition (modifier, supprimer, réordonner), puis l'importe par
 * l'import existant. Les notions créées sont « à valider ».
 */
export function CurriculumGenerate({
  countryId,
  grades,
  subjects,
}: {
  countryId: string;
  grades: readonly { id: string; name: string; archived: boolean }[];
  subjects: readonly {
    id: string;
    code: string;
    name: string;
    icon: string | null;
    archived: boolean;
  }[];
}) {
  const t = useTranslations("reports.generate");
  const issueText = useProposalIssueText();
  const router = useRouter();
  const fileId = useId();
  const liveGrades = grades.filter((g) => !g.archived);
  const liveSubjects = subjects.filter((s) => !s.archived);
  const [grade, setGrade] = useState(liveGrades[0]?.name ?? "");
  const [subject, setSubject] = useState(liveSubjects[0]?.code ?? "");
  const [source, setSource] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [units, setUnits] = useState<DraftUnit[] | null>(null);
  const [existing, setExisting] = useState<ReadonlySet<string>>(new Set());
  // null : pas encore connu ; faux : aucun fournisseur d'IA configuré.
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    browserApi()
      .admin["curriculum-generate"].status.$get()
      .then(async (res) => {
        const body = res.status === 200 ? await res.json() : null;
        if (live)
          setAiReady(
            body !== null && "aiConfigured" in body && body.aiConfigured,
          );
      })
      .catch(() => live && setAiReady(false));
    return () => {
      live = false;
    };
  }, []);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [applied, setApplied] = useState(false);
  const [pending, setPending] = useState<
    null | "file" | "generate" | "check" | "apply"
  >(null);

  const api = () => browserApi().admin["curriculum-generate"].countries[":id"];

  const errorText = (code: unknown) => {
    switch (code) {
      case "ai_not_configured":
      case "ai_unavailable":
        return t("aiUnavailable");
      case "too_many_requests":
        return t("tooMany");
      case "file_too_large":
        return t("fileTooLarge");
      case "file_unreadable":
      case "file_unsupported":
      case "file_empty":
        return t("fileUnreadable");
      default:
        return t("failed");
    }
  };
  const codeOf = async (res: Response) =>
    read(
      read(
        await res
          .clone()
          .json()
          .catch(() => null),
        "error",
      ),
      "code",
    );

  const onFile = async (file: File | undefined) => {
    setError(null);
    setFileName(file?.name ?? null);
    if (!file) return;
    if (file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name)) {
      setSource((await file.text()).slice(0, MAX_SOURCE));
      return;
    }
    setPending("file");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(
      `/api/admin/curriculum-generate/countries/${countryId}/source`,
      { method: "POST", body: form },
    ).catch(() => null);
    setPending(null);
    const body: unknown = res?.ok ? await res.json().catch(() => null) : null;
    const text = read(body, "text");
    if (typeof text === "string") {
      setSource(text);
      if (read(body, "truncated") === true)
        setError(t("truncated", { max: MAX_SOURCE }));
    } else setError(errorText(res ? await codeOf(res) : null));
  };

  const generate = async () => {
    setPending("generate");
    setError(null);
    setIssues([]);
    setPreview(null);
    setApplied(false);
    const res = await api().generate.$post({
      param: { id: countryId },
      json: { grade, subject, source },
    });
    setPending(null);
    const body = res.status === 200 ? await res.json() : null;
    if (!body || !("proposal" in body)) {
      setError(errorText(await codeOf(res)));
      return;
    }
    setExisting(new Set(body.existingCodes));
    setIssues(body.issues);
    setUnits(
      body.proposal.units.map((u) => ({
        key: keyed(),
        name: u.name,
        notions: u.notions.map((n) => ({
          key: keyed(),
          code: n.code,
          name: n.name,
          objective: n.objective,
          prerequisites: n.prerequisites.join(", "),
        })),
      })),
    );
  };

  const send = async (step: "check" | "apply") => {
    if (!units) return;
    setPending(step);
    setError(null);
    setIssues([]);
    const args = {
      param: { id: countryId },
      json: { grade, subject, proposal: toProposal(units) },
    };
    const res =
      step === "check"
        ? await api().proposal.check.$post(args)
        : await api().proposal.apply.$post(args);
    setPending(null);
    const body = res.status === 200 ? await res.json() : null;
    if (body && "summary" in body) {
      setPreview(body);
      if (step === "apply") {
        setApplied(true);
        router.refresh();
      }
    } else {
      setPreview(null);
      const code = await codeOf(res);
      const found = await issuesOf(res);
      if (found.length > 0) setIssues(found);
      else setError(errorText(code));
    }
  };

  const s = preview?.summary;
  return (
    <Panel
      icon={<MagicWand weight="fill" />}
      tone="rose"
      id="programme-ia"
      title={t("title")}
      description={t("hint")}
      contentClassName="flex flex-col gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t("grade")}
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
        >
          {liveGrades.map((g) => (
            <option key={g.id} value={g.name}>
              {g.name}
            </option>
          ))}
        </SelectField>
        <div className="flex items-end gap-2.5">
          <SelectField
            label={t("subject")}
            className="min-w-0 flex-1"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            {liveSubjects.map((x) => (
              <option key={x.id} value={x.code}>
                {x.name}
              </option>
            ))}
          </SelectField>
          <SubjectIcon
            icon={liveSubjects.find((x) => x.code === subject)?.icon}
            size={36}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={fileId}>{t("file")}</Label>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <label htmlFor={fileId} className="cursor-pointer">
              {t("chooseFile")}
            </label>
          </Button>
          <span className="text-sm text-muted-foreground">
            {pending === "file" ? t("reading") : (fileName ?? t("noFile"))}
          </span>
        </div>
        <input
          id={fileId}
          type="file"
          className="sr-only"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      <TextAreaField
        label={t("source")}
        hint={t("sourceHint", { count: source.length, max: MAX_SOURCE })}
        rows={8}
        maxLength={MAX_SOURCE}
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant={units ? "outline" : "brand"}
          disabled={
            aiReady !== true ||
            pending !== null ||
            source.trim() === "" ||
            grade === "" ||
            subject === ""
          }
          onClick={generate}
        >
          <MagicWand aria-hidden />
          {pending === "generate" ? t("generating") : t("generate")}
        </Button>
      </div>
      {aiReady === false && (
        <Alert variant="warning" role="status">
          <WarningCircle aria-hidden />
          <AlertDescription>{t("aiUnavailable")}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="warning" role="alert">
          <WarningCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {units && (
        <section className="space-y-4" aria-labelledby={`${fileId}-review`}>
          <div className="space-y-1">
            <h3 id={`${fileId}-review`} className="font-semibold">
              {t("reviewTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("reviewHint")}</p>
          </div>
          <Review
            units={units}
            setUnits={(u) => {
              setUnits(u);
              setPreview(null);
            }}
            existing={existing}
          />
          {issues.length > 0 && (
            <div role="alert" className="space-y-1 text-sm text-destructive">
              <p className="font-medium">{t("issues")}</p>
              <ul className="list-disc pl-5">
                {issues.map((i) => (
                  <li key={JSON.stringify(i)}>{issueText(i)}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={pending !== null || units.length === 0}
              onClick={() => send("check")}
            >
              {t("check")}
            </Button>
            {preview && !preview.empty && !applied && (
              <Button
                variant="brand"
                disabled={pending !== null}
                onClick={() => send("apply")}
              >
                {t("apply")}
              </Button>
            )}
          </div>
          {applied && (
            <p role="status" className="text-sm font-medium">
              {t("applied")}
            </p>
          )}
          {s && (
            <Card
              variant="flat"
              className="grid gap-4 border-[color-mix(in_srgb,var(--glow-mint-a)_35%,var(--border))] p-4 sm:grid-cols-2"
            >
              <SummaryList title={t("summary.programs")} items={s.programs} />
              <SummaryList title={t("summary.units")} items={s.units} />
              <SummaryList
                title={t("summary.newNotions")}
                items={s.newNotions}
              />
              <SummaryList
                title={t("summary.updatedNotions")}
                items={s.updatedNotions.map((u) => u.code)}
              />
              <SummaryList
                title={t("summary.prerequisites")}
                items={s.prerequisites.map(
                  (p) => `${p.code} : ${p.after.join(", ") || "∅"}`,
                )}
              />
            </Card>
          )}
        </section>
      )}
    </Panel>
  );
}
