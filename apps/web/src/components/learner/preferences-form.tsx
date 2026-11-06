"use client";

import { Plus, X } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import { Switch } from "@wema/ui/components/ui/switch";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LEARNER_PREFERENCES } from "../../lib/learner-types";
import { useLearnerMutation } from "./use-learner-mutation";

/**
 * Préférences de l'élève. Chaque changement est une déclaration ajoutée au
 * journal (POST /learner/preferences) : le profil est recalculé, jamais écrit.
 */
export function PreferencesForm({
  active,
  interests,
}: {
  /** Préférences actuellement retenues par le profil. */
  active: string[];
  interests: string[];
}) {
  const t = useTranslations("learner.profile");
  const { run, pending, error } = useLearnerMutation();
  const [values, setValues] = useState(
    () =>
      new Map<string, boolean>(
        LEARNER_PREFERENCES.map((k) => [k, active.includes(k)]),
      ),
  );
  const [interest, setInterest] = useState("");

  async function toggle(key: string, value: boolean) {
    setValues((m) => new Map(m).set(key, value));
    const result = await run("POST", "/learner/preferences", { key, value });
    if (!result.ok) setValues((m) => new Map(m).set(key, !value));
  }

  async function addInterest() {
    const label = interest.trim();
    if (!label) return;
    const result = await run("POST", "/learner/preferences", {
      key: "interest",
      label,
      value: true,
    });
    if (result.ok) setInterest("");
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-3">
        {LEARNER_PREFERENCES.map((key) => (
          <li key={key} className="flex items-center justify-between gap-4">
            <Label htmlFor={`pref-${key}`} className="font-normal">
              {t(`prefs.${key}`)}
            </Label>
            <Switch
              id={`pref-${key}`}
              checked={values.get(key) === true}
              disabled={pending}
              onCheckedChange={(v) => toggle(key, v)}
            />
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="interest">{t("interests")}</Label>
          <p className="text-sm text-muted-foreground">{t("interestsHelp")}</p>
        </div>
        {interests.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {interests.map((label) => (
              <li
                key={label}
                className="inline-flex items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3 text-sm"
              >
                {label}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 rounded-full"
                  disabled={pending}
                  aria-label={t("removeInterest", { label })}
                  onClick={() =>
                    run("POST", "/learner/preferences", {
                      key: "interest",
                      label,
                      value: false,
                    })
                  }
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addInterest();
          }}
        >
          <Input
            id="interest"
            value={interest}
            maxLength={40}
            placeholder={t("interestPlaceholder")}
            onChange={(e) => setInterest(e.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={pending || interest.trim() === ""}
          >
            <Plus />
            {t("addInterest")}
          </Button>
        </form>
      </div>
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
