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
import { useMutation } from "../../../lib/use-mutation";
import { Notice, TextField } from "../_ui/fields";

/** Réglages RGPD (fiche 0008), lus et écrits par /admin/privacy/settings. */
export interface PrivacySettings {
  deletionGraceDays: number;
  inactiveAccountDays: number;
  oneTimeCodeDays: number;
  aiCallDays: number;
  deliveryLogDays: number;
  tutorConversationDays: number | null;
  digitalConsentAge: number;
  termsVersion: string;
  privacyVersion: string;
}

const NUMBERS = [
  "deletionGraceDays",
  "inactiveAccountDays",
  "oneTimeCodeDays",
  "aiCallDays",
  "deliveryLogDays",
  "digitalConsentAge",
] as const;

type Values = Record<
  | (typeof NUMBERS)[number]
  | "tutorConversationDays"
  | "termsVersion"
  | "privacyVersion",
  string
>;

const toValues = (s: PrivacySettings): Values => ({
  deletionGraceDays: String(s.deletionGraceDays),
  inactiveAccountDays: String(s.inactiveAccountDays),
  oneTimeCodeDays: String(s.oneTimeCodeDays),
  aiCallDays: String(s.aiCallDays),
  deliveryLogDays: String(s.deliveryLogDays),
  digitalConsentAge: String(s.digitalConsentAge),
  tutorConversationDays:
    s.tutorConversationDays === null ? "" : String(s.tutorConversationDays),
  termsVersion: s.termsVersion,
  privacyVersion: s.privacyVersion,
});

export function PrivacyForm({ settings }: { settings: PrivacySettings }) {
  const t = useTranslations("legal.admin");
  const { run, pending, error } = useMutation();
  const [values, setValues] = useState<Values>(toValues(settings));
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const tutor = values.tutorConversationDays.trim();
    const result = await run("PUT", "/admin/privacy/settings", {
      ...Object.fromEntries(NUMBERS.map((k) => [k, Number(values[k])])),
      tutorConversationDays: tutor === "" ? null : Number(tutor),
      termsVersion: values.termsVersion.trim(),
      privacyVersion: values.privacyVersion.trim(),
    });
    if (result.ok) setSaved(true);
  }

  const set = (key: keyof Values, value: string) =>
    setValues({ ...values, [key]: value });

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            {NUMBERS.map((key) => (
              <TextField
                key={key}
                label={t(key)}
                hint={
                  key === "digitalConsentAge"
                    ? t("digitalConsentAgeHint")
                    : undefined
                }
                inputMode="numeric"
                required
                value={values[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            ))}
            <TextField
              label={t("tutorConversationDays")}
              hint={t("tutorConversationHint")}
              inputMode="numeric"
              value={values.tutorConversationDays}
              onChange={(e) => set("tutorConversationDays", e.target.value)}
            />
            <TextField
              label={t("termsVersion")}
              required
              value={values.termsVersion}
              onChange={(e) => set("termsVersion", e.target.value)}
            />
            <TextField
              label={t("privacyVersion")}
              required
              value={values.privacyVersion}
              onChange={(e) => set("privacyVersion", e.target.value)}
            />
          </div>
          {error ? <Notice tone="error">{error}</Notice> : null}
          {saved ? <Notice tone="success">{t("saved")}</Notice> : null}
          <div>
            <Button type="submit" variant="outline" disabled={pending}>
              {t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
