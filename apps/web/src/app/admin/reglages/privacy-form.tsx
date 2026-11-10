"use client";

import { ShieldCheck } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { toast } from "@wema/ui/components/ui/sonner";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useMutation } from "../../../lib/use-mutation";
import { Notice, TextField } from "../_ui/fields";
import { Panel } from "../_ui/kit";

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

  async function submit(e: FormEvent) {
    e.preventDefault();
    const tutor = values.tutorConversationDays.trim();
    const result = await run("PUT", "/admin/privacy/settings", {
      ...Object.fromEntries(NUMBERS.map((k) => [k, Number(values[k])])),
      tutorConversationDays: tutor === "" ? null : Number(tutor),
      termsVersion: values.termsVersion.trim(),
      privacyVersion: values.privacyVersion.trim(),
    });
    if (result.ok) toast.success(t("saved"));
  }

  const set = (key: keyof Values, value: string) =>
    setValues({ ...values, [key]: value });

  return (
    <form onSubmit={submit}>
      <Panel
        icon={<ShieldCheck weight="fill" />}
        tone="slate"
        title={t("title")}
        description={t("subtitle")}
        contentClassName="flex flex-col gap-5"
      >
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
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
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {t("save")}
          </Button>
        </div>
      </Panel>
    </form>
  );
}
