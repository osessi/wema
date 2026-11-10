"use client";

import {
  ArrowCounterClockwise,
  ChartLineUp,
  Target,
} from "@phosphor-icons/react";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { toast } from "@wema/ui/components/ui/sonner";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { read } from "../../../lib/mutate";
import type { PedagogySettings } from "../../../lib/types";
import { useMutation } from "../../../lib/use-mutation";
import { Notice, TextField } from "../_ui/fields";
import { Panel } from "../_ui/kit";

type Key =
  | "inProgressThreshold"
  | "masteryThreshold"
  | "reconfirmDelayHours"
  | "misconceptionClearingStreak"
  | "pInit"
  | "pLearn"
  | "pSlip"
  | "pGuess";

type Values = Record<Key, string>;

// Les champs gardent la saisie brute (« 0,95 » ou « 0.95 ») ; elle est
// convertie en nombre à l'envoi.
const toValues = (s: PedagogySettings): Values => ({
  inProgressThreshold: String(s.inProgressThreshold),
  masteryThreshold: String(s.masteryThreshold),
  reconfirmDelayHours: String(s.reconfirmDelayHours),
  misconceptionClearingStreak: String(s.misconceptionClearingStreak),
  pInit: String(s.bkt.pInit),
  pLearn: String(s.bkt.pLearn),
  pSlip: String(s.bkt.pSlip),
  pGuess: String(s.bkt.pGuess),
});

const toNumber = (v: string) => Number(v.trim().replace(",", "."));

/** Messages de validation renvoyés par le serveur (liste de { path, message }). */
function issueMessages(details: unknown): string[] {
  if (!Array.isArray(details)) return [];
  return details.flatMap((d: unknown) => {
    const message = read(d, "message");
    return typeof message === "string" ? [message] : [];
  });
}

export function SettingsForm({
  settings,
  defaults,
}: {
  settings: PedagogySettings;
  defaults: PedagogySettings;
}) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const [saved, setSaved] = useState<Values>(() => toValues(settings));
  const [values, setValues] = useState<Values>(saved);
  const [issues, setIssues] = useState<string[]>([]);
  const initial = toValues(defaults);
  const dirty = (Object.keys(values) as Key[]).some(
    (k) => toNumber(values[k]) !== toNumber(saved[k]),
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setIssues([]);
    const result = await run("PUT", "/admin/settings/pedagogy", {
      inProgressThreshold: toNumber(values.inProgressThreshold),
      masteryThreshold: toNumber(values.masteryThreshold),
      reconfirmDelayHours: toNumber(values.reconfirmDelayHours),
      misconceptionClearingStreak: toNumber(values.misconceptionClearingStreak),
      bkt: {
        pInit: toNumber(values.pInit),
        pLearn: toNumber(values.pLearn),
        pSlip: toNumber(values.pSlip),
        pGuess: toNumber(values.pGuess),
      },
    });
    if (result.ok) {
      setSaved(values);
      toast.success(t("common.saved"));
    } else setIssues(issueMessages(result.details));
  }

  const field = (key: Key, hint: boolean, integer = false) => {
    const changed = toNumber(values[key]) !== toNumber(initial[key]);
    return (
      <TextField
        label={
          <span className="flex w-full flex-wrap items-center gap-2">
            {t(`settings.${key}`)}
            <Badge
              variant={changed ? "warning" : "neutral"}
              className="font-mono text-[11px] tabular-nums"
            >
              {t("settings.defaultValue", {
                value: initial[key].replace(".", ","),
              })}
            </Badge>
          </span>
        }
        hint={hint ? t(`settings.${key}Hint`) : undefined}
        inputMode={integer ? "numeric" : "decimal"}
        required
        className="content-start"
        value={values[key]}
        onChange={(e) => setValues({ ...values, [key]: e.target.value })}
      />
    );
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={submit}>
      <Panel
        icon={<Target weight="fill" />}
        tone="mint"
        title={t("settings.statuses")}
        description={t("settings.statusesHint")}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setValues(initial)}
          >
            <ArrowCounterClockwise aria-hidden />
            {t("settings.reset")}
          </Button>
        }
        contentClassName="grid gap-x-6 gap-y-5 md:grid-cols-2"
      >
        {field("inProgressThreshold", true)}
        {field("masteryThreshold", true)}
        {field("reconfirmDelayHours", true, true)}
        {field("misconceptionClearingStreak", true, true)}
      </Panel>
      <Panel
        icon={<ChartLineUp weight="fill" />}
        tone="sky"
        title={t("settings.bkt")}
        description={t("settings.bktHint")}
        contentClassName="grid gap-x-6 gap-y-5 md:grid-cols-2"
      >
        {field("pInit", true)}
        {field("pLearn", false)}
        {field("pSlip", true)}
        {field("pGuess", true)}
      </Panel>
      {error ? (
        <Notice tone="error">
          {error}
          {issues.length > 0 ? (
            <ul className="mt-1.5 list-disc pl-5">
              {issues.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}
      {dirty ? (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-card border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
          <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <Badge variant="warning">{t("settings.unsavedBadge")}</Badge>
            <span className="text-muted-foreground">
              {t("settings.unsaved")}
            </span>
          </span>
          <span className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setValues(saved)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {t("common.save")}
            </Button>
          </span>
        </div>
      ) : null}
    </form>
  );
}
