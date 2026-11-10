"use client";

import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import { Label } from "@wema/ui/components/ui/label";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { browserApi } from "../../../../lib/insights-client";
import type {
  ExercisePreview,
  ImportPreview,
} from "../../../../lib/insights-types";
import { read } from "../../../../lib/mutate";
import { SelectField, TextAreaField } from "../../_ui/fields";

type Issue = Record<string, unknown>;

/** Erreurs de validation renvoyées par l'API (détails de « invalid_import »). */
async function issuesOf(res: Response): Promise<Issue[]> {
  const body: unknown = await res.json().catch(() => null);
  const details = read(read(body, "error"), "details");
  return Array.isArray(details)
    ? details.filter((d): d is Issue => typeof d === "object" && d !== null)
    : [];
}

function useIssueText() {
  const t = useTranslations("insights.transfer.issue");
  return (i: Issue) => {
    const s = (k: string) => {
      const v = i[k];
      return typeof v === "string" || typeof v === "number" ? String(v) : "";
    };
    switch (i.kind) {
      case "parse":
        return t("parse", { message: s("message") });
      case "csv":
        return t("csv", { line: s("line"), message: s("message") });
      case "unknown_subject":
        return t("unknown_subject", { subject: s("subject") });
      case "country_mismatch":
        return t("country_mismatch", {
          found: s("found"),
          expected: s("expected"),
        });
      case "duplicate_code_in_file":
        return t("duplicate_code_in_file", { code: s("code") });
      case "empty":
        return t("empty");
      case "unknown_prerequisite":
        return t("unknown_prerequisite", {
          notion: s("notionId"),
          prerequisite: s("prerequisiteId"),
        });
      case "prerequisite_cycle":
        return t("prerequisite_cycle", {
          cycle: Array.isArray(i.cycle) ? i.cycle.join(" → ") : "",
        });
      default:
        return t("other", { detail: JSON.stringify(i) });
    }
  };
}

function FileOrText({
  value,
  onChange,
  label,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  hint: string;
}) {
  const t = useTranslations("insights.transfer");
  const id = useId();
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor={id}>{t("file")}</Label>
        {/* Champ natif masqué : son bouton « Choose File » suit la langue du
            navigateur. On affiche notre propre bouton, en français. */}
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <label htmlFor={id} className="cursor-pointer">
              {t("chooseFile")}
            </label>
          </Button>
          <span className="text-sm text-muted-foreground">
            {fileName ?? t("noFile")}
          </span>
        </div>
        <input
          id={id}
          type="file"
          className="sr-only"
          accept=".yaml,.yml,.csv,text/csv,application/yaml,text/yaml"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setFileName(file?.name ?? null);
            if (file) onChange(await file.text());
          }}
        />
      </div>
      <TextAreaField
        label={label}
        hint={hint}
        rows={8}
        className="font-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-1">
      <h4 className="text-sm font-semibold">
        {title} ({items.length})
      </h4>
      <ul className="max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}

function CurriculumImport({ countryId }: { countryId: string }) {
  const t = useTranslations("insights.transfer");
  const issueText = useIssueText();
  const router = useRouter();
  const [format, setFormat] = useState<"yaml" | "csv">("yaml");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pending, setPending] = useState(false);
  const [applied, setApplied] = useState(false);

  const send = async (step: "preview" | "apply") => {
    setPending(true);
    setIssues([]);
    setApplied(false);
    const api = browserApi().admin["curriculum-io"].countries[":id"].import;
    const args = { param: { id: countryId }, json: { format, content } };
    const res =
      step === "preview"
        ? await api.preview.$post(args)
        : await api.apply.$post(args);
    setPending(false);
    const body = res.status === 200 ? await res.json() : null;
    if (body && "summary" in body) {
      setPreview(body);
      if (step === "apply") {
        setApplied(true);
        router.refresh();
      }
    } else {
      setPreview(null);
      setIssues(await issuesOf(res));
    }
  };

  const s = preview?.summary;
  return (
    <div className="flex flex-col gap-4">
      <SelectField
        label={t("format")}
        value={format}
        onChange={(e) => {
          setFormat(e.target.value === "csv" ? "csv" : "yaml");
          setPreview(null);
        }}
      >
        <option value="yaml">{t("yaml")}</option>
        <option value="csv">{t("csv")}</option>
      </SelectField>
      <FileOrText
        value={content}
        onChange={(v) => {
          setContent(v);
          setPreview(null);
        }}
        label={t("content")}
        hint={t("contentHint")}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={pending || content.trim() === ""}
          onClick={() => send("preview")}
        >
          {t("preview")}
        </Button>
        {preview && !preview.empty && !applied && (
          <Button disabled={pending} onClick={() => send("apply")}>
            {t("apply")}
          </Button>
        )}
      </div>
      {issues.length > 0 && (
        <div role="alert" className="space-y-1 text-sm text-destructive">
          <p className="font-medium">{t("invalid")}</p>
          <ul className="list-disc pl-5">
            {issues.map((i) => (
              <li key={JSON.stringify(i)}>{issueText(i)}</li>
            ))}
          </ul>
        </div>
      )}
      {applied && (
        <p role="status" className="text-sm font-medium">
          {t("applied")}
        </p>
      )}
      {s && (
        <div className="space-y-3 rounded-lg border p-3">
          {preview.empty ? (
            <p className="text-sm">{t("nothing")}</p>
          ) : (
            <>
              <SummaryList title={t("grades")} items={s.grades} />
              <SummaryList title={t("programs")} items={s.programs} />
              <SummaryList title={t("units")} items={s.units} />
              <SummaryList title={t("newNotions")} items={s.newNotions} />
              <SummaryList
                title={t("updatedNotions")}
                items={s.updatedNotions.map(
                  (u) =>
                    `${u.code} (${u.fields
                      .map((f) =>
                        f === "name" || f === "description" || f === "unit"
                          ? t(`fields.${f}`)
                          : f,
                      )
                      .join(", ")})`,
                )}
              />
              <SummaryList
                title={t("prerequisites")}
                items={s.prerequisites.map(
                  (p) =>
                    `${p.code} : ${p.before.join(", ") || "∅"} → ${p.after.join(", ") || "∅"}`,
                )}
              />
              <SummaryList
                title={t("misconceptions")}
                items={s.misconceptions.map(
                  (m) => `${m.code} : ${m.description}`,
                )}
              />
            </>
          )}
          <p className="text-sm text-muted-foreground">
            {t("untouched", { count: s.untouched })}
          </p>
        </div>
      )}
    </div>
  );
}

function ExerciseImport({ countryId }: { countryId: string }) {
  const t = useTranslations("insights.transfer");
  const issueText = useIssueText();
  const [content, setContent] = useState("");
  const [items, setItems] = useState<ExercisePreview["items"] | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [created, setCreated] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  const send = async (step: "preview" | "apply") => {
    setPending(true);
    setIssues([]);
    setCreated(null);
    const api = browserApi().admin["curriculum-io"].countries[":id"].exercises;
    const args = { param: { id: countryId }, json: { content } };
    const res =
      step === "preview"
        ? await api.preview.$post(args)
        : await api.apply.$post(args);
    setPending(false);
    const body = res.status === 200 ? await res.json() : null;
    if (body && "items" in body) {
      setItems(body.items);
      const n = read(body, "created");
      if (typeof n === "number") setCreated(n);
    } else {
      setItems(null);
      setIssues(await issuesOf(res));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <FileOrText
        value={content}
        onChange={(v) => {
          setContent(v);
          setItems(null);
        }}
        label={t("content")}
        hint={t("exercisesHint")}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={pending || content.trim() === ""}
          onClick={() => send("preview")}
        >
          {t("preview")}
        </Button>
        {items?.some((i) => i.status === "ok") && created === null && (
          <Button disabled={pending} onClick={() => send("apply")}>
            {t("exercisesApply")}
          </Button>
        )}
      </div>
      {issues.length > 0 && (
        <div role="alert" className="space-y-1 text-sm text-destructive">
          <p className="font-medium">{t("invalid")}</p>
          <ul className="list-disc pl-5">
            {issues.map((i) => (
              <li key={JSON.stringify(i)}>{issueText(i)}</li>
            ))}
          </ul>
        </div>
      )}
      {created !== null && (
        <p role="status" className="text-sm font-medium">
          {t("exercisesDone", { count: created })}
        </p>
      )}
      {items && (
        <ul className="space-y-1 text-sm">
          {items.map((i) => (
            <li
              key={i.index}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"
            >
              <span>
                <span className="font-mono text-xs">{i.notionCode}</span> ·{" "}
                {i.objective}
              </span>
              <Badge variant={i.status === "ok" ? "default" : "outline"}>
                {t(`exerciseStatus.${i.status}`)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Import et export du référentiel d'un pays, et import en masse d'exercices. */
export function CurriculumTransfer({
  countryId,
  canWrite,
}: {
  countryId: string;
  canWrite: boolean;
}) {
  const t = useTranslations("insights.transfer");
  const base = `/api/admin/curriculum-io/countries/${countryId}/export`;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">{t("title")}</CardTitle>
          <CardDescription>{t("hint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href={`${base}?format=yaml`} download>
                {t("exportYaml")}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`${base}?format=csv`} download>
                {t("exportCsv")}
              </a>
            </Button>
          </div>
          {canWrite && <CurriculumImport countryId={countryId} />}
        </CardContent>
      </Card>
      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">
              {t("exercisesTitle")}
            </CardTitle>
            <CardDescription>{t("exercisesHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ExerciseImport countryId={countryId} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
