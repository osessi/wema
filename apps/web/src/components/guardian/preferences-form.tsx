"use client";

import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@wema/ui/components/ui/toggle-group";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import {
  FORMAT_PREFERENCES,
  type FormatPreference,
  type ProfileHypothesis,
} from "../../lib/guardian-types";
import { useMutation } from "../../lib/use-mutation";

/**
 * Préférences de format déclarées par le parent. Chaque déclaration est
 * ajoutée au journal de l'élève : le profil en est recalculé, rien n'est écrasé.
 */
export function PreferencesForm({
  base,
  hypotheses,
}: {
  base: string;
  hypotheses: ProfileHypothesis[];
}) {
  const t = useTranslations("guardian.preferences");
  const { run, pending, error } = useMutation();
  const [interest, setInterest] = useState("");
  const [saved, setSaved] = useState(false);

  const current = (key: FormatPreference) => {
    const h = hypotheses.find((x) => x.key === key);
    if (!h) return "";
    return h.status === "contradicted" ? "no" : "yes";
  };
  const interests = hypotheses.filter((h) => h.key.startsWith("interest:"));

  async function declare(key: string, value: boolean, label?: string) {
    setSaved(false);
    const result = await run("POST", `${base}/preferences`, {
      key,
      value,
      label: label ?? null,
    });
    if (result.ok) setSaved(true);
  }

  async function addInterest(e: FormEvent) {
    e.preventDefault();
    if (!interest.trim()) return;
    await declare("interest", true, interest.trim());
    setInterest("");
  }

  return (
    <div className="space-y-5">
      <ul className="divide-y rounded-lg border">
        {FORMAT_PREFERENCES.map((key) => (
          <li
            key={key}
            className="flex flex-wrap items-center justify-between gap-3 p-3"
          >
            <span className="text-sm">{t(`keys.${key}`)}</span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={current(key)}
              disabled={pending}
              onValueChange={(v) => {
                if (v === "yes" || v === "no") declare(key, v === "yes");
              }}
              aria-label={t(`keys.${key}`)}
            >
              <ToggleGroupItem value="yes">{t("yes")}</ToggleGroupItem>
              <ToggleGroupItem value="no">{t("no")}</ToggleGroupItem>
            </ToggleGroup>
          </li>
        ))}
      </ul>
      <form onSubmit={addInterest} className="space-y-2">
        <Label htmlFor="interest">{t("interest")}</Label>
        <p className="text-sm text-muted-foreground">{t("interestHint")}</p>
        <div className="flex max-w-md gap-2">
          <Input
            id="interest"
            value={interest}
            maxLength={40}
            onChange={(e) => setInterest(e.target.value)}
            placeholder={t("interestPlaceholder")}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={pending || !interest.trim()}
          >
            {t("addInterest")}
          </Button>
        </div>
        {interests.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {interests.map((h) => (
              <span
                key={h.key}
                className="rounded-full border px-2.5 py-0.5 text-xs"
              >
                {h.key.slice("interest:".length)}
              </span>
            ))}
          </div>
        )}
      </form>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {saved && !error && (
        <p className="text-sm text-muted-foreground" role="status">
          {t("saved")}
        </p>
      )}
    </div>
  );
}
