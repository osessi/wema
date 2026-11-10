"use client";

import {
  ChatTeardropText,
  Footprints,
  type Icon,
  Lightbulb,
  Plus,
  Shapes,
  SpeakerHigh,
  Timer,
  X,
} from "@phosphor-icons/react";
import type { GlowTone } from "@wema/ui/brand";
import { Button } from "@wema/ui/components/ui/button";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import { toast } from "@wema/ui/components/ui/sonner";
import { ChoiceCards } from "@wema/ui/components/wema/choice-cards";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LEARNER_PREFERENCES } from "../../lib/learner-types";

type PreferenceKey = (typeof LEARNER_PREFERENCES)[number];

/** Pastille de chaque préférence. */
const PREFERENCE_VISUALS: Record<
  PreferenceKey,
  { icon: Icon; tone: GlowTone }
> = {
  "format.scaffolded": { icon: Footprints, tone: "sky" },
  "format.examples": { icon: Lightbulb, tone: "yellow" },
  "format.visual": { icon: Shapes, tone: "mint" },
  "format.comics": { icon: ChatTeardropText, tone: "rose" },
  "format.audio": { icon: SpeakerHigh, tone: "amber" },
  "pace.short_sessions": { icon: Timer, tone: "slate" },
};

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
    else toast.success(t("saved"));
  }

  async function addInterest() {
    const label = interest.trim();
    if (!label) return;
    const result = await run("POST", "/learner/preferences", {
      key: "interest",
      label,
      value: true,
    });
    if (result.ok) {
      setInterest("");
      toast.success(t("saved"));
    }
  }

  return (
    <div className="space-y-6">
      <ChoiceCards
        type="multiple"
        aria-label={t("preferences")}
        size="compact"
        disabled={pending}
        value={LEARNER_PREFERENCES.filter((k) => values.get(k) === true)}
        onValueChange={(next) => {
          const changed = LEARNER_PREFERENCES.find(
            (k) => next.includes(k) !== (values.get(k) === true),
          );
          if (changed) void toggle(changed, next.includes(changed));
        }}
        options={LEARNER_PREFERENCES.map((key) => {
          const { icon: Glyph, tone } = PREFERENCE_VISUALS[key];
          return {
            value: key,
            title: t(`prefs.${key}`),
            icon: <Glyph weight="fill" />,
            tone,
          };
        })}
      />

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
                className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-0.5 pr-0.5 pl-3 text-sm font-medium text-brand-text"
              >
                {label}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 rounded-full"
                  disabled={pending}
                  aria-label={t("removeInterest", { label })}
                  onClick={async () => {
                    const result = await run("POST", "/learner/preferences", {
                      key: "interest",
                      label,
                      value: false,
                    });
                    if (result.ok) toast.success(t("saved"));
                  }}
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
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
