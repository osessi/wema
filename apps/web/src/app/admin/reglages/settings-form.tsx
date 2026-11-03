"use client";

import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { read } from "../../../lib/mutate";
import type { PedagogySettings } from "../../../lib/types";
import { useMutation } from "../../../lib/use-mutation";
import { Notice, TextField } from "../_ui/fields";

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
  const [values, setValues] = useState<Values>(toValues(settings));
  const [issues, setIssues] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
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
    if (result.ok) setSaved(true);
    else setIssues(issueMessages(result.details));
  }

  const field = (key: Key, hint: boolean, integer = false) => (
    <TextField
      label={t(`settings.${key}`)}
      hint={hint ? t(`settings.${key}Hint`) : undefined}
      inputMode={integer ? "numeric" : "decimal"}
      required
      value={values[key]}
      onChange={(e) => setValues({ ...values, [key]: e.target.value })}
    />
  );

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">
            {t("settings.statuses")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {field("inProgressThreshold", true)}
          {field("masteryThreshold", true)}
          {field("reconfirmDelayHours", true, true)}
          {field("misconceptionClearingStreak", true, true)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">
            {t("settings.bkt")}
          </CardTitle>
          <CardDescription>{t("settings.bktHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {field("pInit", true)}
          {field("pLearn", false)}
          {field("pSlip", true)}
          {field("pGuess", true)}
        </CardContent>
      </Card>
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
      {saved ? <Notice tone="success">{t("common.saved")}</Notice> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {t("common.save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setValues(toValues(defaults));
            setSaved(false);
          }}
        >
          {t("settings.reset")}
        </Button>
      </div>
    </form>
  );
}
