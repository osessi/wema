"use client";

import { FloppyDisk, PaperPlaneTilt, ShieldCheck } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import { NativeSelect } from "@wema/ui/components/ui/native-select";
import { toast } from "@wema/ui/components/ui/sonner";
import { Textarea } from "@wema/ui/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@wema/ui/components/ui/toggle-group";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Section } from "../../../../components/guardian/section";
import { mutate } from "../../../../lib/mutate";
import type { AdvisorSheet } from "../../../../lib/onboarding-types";

const FIELDS = [
  "since",
  "where",
  "blockers",
  "motivation",
  "learningStyle",
  "needs",
] as const;
type Field = (typeof FIELDS)[number];
const ERRORS = ["health_term", "not_started", "empty_report"] as const;
/** Confiances proposées : un avis humain sur 15 minutes reste plafonné à 50 %. */
const CONFIDENCES = [0.3, 0.4, 0.5];

type Opinion = { value: boolean; confidence: number } | null;

export function DiagnosticSheetForm({
  sheet,
  preferences,
}: {
  sheet: AdvisorSheet;
  preferences: { key: string; statement: string }[];
}) {
  const t = useTranslations("diagnostic.sheet");
  const id = useId();
  const router = useRouter();
  const published = sheet.status === "done";
  const [fields, setFields] = useState<Record<Field, string>>({
    ...sheet.sheet,
  });
  const [opinions, setOpinions] = useState<Record<string, Opinion>>(() =>
    Object.fromEntries(
      sheet.hypotheses
        .filter((h) => h.key !== "interest")
        .map((h) => [h.key, { value: h.value, confidence: h.confidence }]),
    ),
  );
  const [interests, setInterests] = useState(
    sheet.hypotheses
      .filter((h) => h.key === "interest" && h.label)
      .map((h) => h.label)
      .join(", "),
  );
  const [notes, setNotes] = useState(sheet.notes);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorText = (code: string) => {
    const known = ERRORS.find((e) => e === code);
    return known ? t(`errors.${known}`) : t("errors.generic");
  };

  const body = () => ({
    sheet: fields,
    notes,
    hypotheses: [
      ...Object.entries(opinions).flatMap(([key, o]) =>
        o
          ? [{ key, label: null, value: o.value, confidence: o.confidence }]
          : [],
      ),
      ...interests
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5)
        .map((label) => ({
          key: "interest",
          label: label.slice(0, 40),
          value: true,
          confidence: 0.5,
        })),
    ],
  });

  async function save(): Promise<boolean> {
    setPending(true);
    setError(null);
    const result = await mutate(
      "PUT",
      `/diagnostic/advisor/${sheet.id}`,
      body(),
    );
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.code));
      return false;
    }
    return true;
  }

  const started = new Date(sheet.startsAt).getTime() <= Date.now();

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await save()) {
          toast.success(t("saved"));
          router.refresh();
        }
      }}
    >
      {published ? (
        <Alert variant="success">
          <AlertDescription>{t("published")}</AlertDescription>
        </Alert>
      ) : null}
      <Alert variant="info">
        <ShieldCheck aria-hidden />
        <AlertDescription>{t("healthNotice")}</AlertDescription>
      </Alert>

      <Section title={t("title", { name: sheet.learnerName })}>
        <div className="grid gap-4 md:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f} className="flex flex-col gap-2">
              <Label htmlFor={`${id}-${f}`}>{t(`fields.${f}`)}</Label>
              <Textarea
                id={`${id}-${f}`}
                rows={3}
                maxLength={1000}
                readOnly={published}
                value={fields[f]}
                onChange={(e) => setFields({ ...fields, [f]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("hypotheses")} description={t("hypothesesText")}>
        <ul className="flex flex-col divide-y rounded-card border">
          {preferences.map((p) => {
            const o = opinions[p.key] ?? null;
            const choice = o === null ? "none" : o.value ? "yes" : "no";
            return (
              <li
                key={p.key}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0 flex-1 text-sm" id={`${id}-${p.key}`}>
                  {p.statement}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    disabled={published}
                    value={choice}
                    aria-labelledby={`${id}-${p.key}`}
                    onValueChange={(v) =>
                      setOpinions({
                        ...opinions,
                        [p.key]:
                          v === "yes" || v === "no"
                            ? {
                                value: v === "yes",
                                confidence: o?.confidence ?? 0.5,
                              }
                            : null,
                      })
                    }
                  >
                    {(["none", "yes", "no"] as const).map((v) => (
                      <ToggleGroupItem key={v} value={v}>
                        {t(`hypothesis.${v}`)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  {o ? (
                    <NativeSelect
                      aria-label={`${t("hypothesis.confidence")} · ${p.statement}`}
                      disabled={published}
                      value={String(o.confidence)}
                      onChange={(e) =>
                        setOpinions({
                          ...opinions,
                          [p.key]: { ...o, confidence: Number(e.target.value) },
                        })
                      }
                    >
                      {CONFIDENCES.map((c) => (
                        <option key={c} value={c}>
                          {t("hypothesis.confidence")} {Math.round(c * 100)} %
                        </option>
                      ))}
                    </NativeSelect>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-interests`}>{t("hypothesis.interest")}</Label>
          <Input
            id={`${id}-interests`}
            readOnly={published}
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
          />
        </div>
      </Section>

      <Section title={t("notes")} description={t("notesHint")}>
        <Textarea
          aria-label={t("notes")}
          rows={4}
          maxLength={4000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Section>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          <FloppyDisk aria-hidden />
          {t("save")}
        </Button>
        {published ? null : started ? (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="brand" disabled={pending}>
                <PaperPlaneTilt aria-hidden />
                {t("publish")}
              </Button>
            }
            title={t("publishTitle")}
            description={t("publishText")}
            onConfirm={async () => {
              if (!(await save())) return false;
              const result = await mutate(
                "POST",
                `/diagnostic/advisor/${sheet.id}/report`,
              );
              if (!result.ok) {
                setError(errorText(result.code));
                return true;
              }
              router.refresh();
              return true;
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("notYet")}</p>
        )}
      </div>
    </form>
  );
}
