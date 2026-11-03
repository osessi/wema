"use client";

import { Alert, Button, Card, TextField } from "@wema/ui";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { read } from "../../../lib/mutate";
import type { PedagogySettings } from "../../../lib/types";
import { useMutation } from "../../../lib/use-mutation";

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
    <form className="w-stack" style={{ gap: 20 }} onSubmit={submit}>
      <Card title={t("settings.statuses")}>
        <div className="w-grid w-grid--wide">
          {field("inProgressThreshold", true)}
          {field("masteryThreshold", true)}
          {field("reconfirmDelayHours", true, true)}
          {field("misconceptionClearingStreak", true, true)}
        </div>
      </Card>
      <Card title={t("settings.bkt")} subtitle={t("settings.bktHint")}>
        <div className="w-grid w-grid--wide">
          {field("pInit", true)}
          {field("pLearn", false)}
          {field("pSlip", true)}
          {field("pGuess", true)}
        </div>
      </Card>
      {error ? (
        <Alert tone="error">
          {error}
          {issues.length > 0 ? (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {issues.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      {saved ? <Alert tone="success">{t("common.saved")}</Alert> : null}
      <div className="w-row">
        <Button type="submit" disabled={pending}>
          {t("common.save")}
        </Button>
        <Button
          variant="secondary"
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
