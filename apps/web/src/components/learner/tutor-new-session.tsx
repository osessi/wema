"use client";

import { Button } from "@wema/ui/components/ui/button";
import { Label } from "@wema/ui/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@wema/ui/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@wema/ui/components/ui/radio-group";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  EXERCISE_MODES,
  TUTOR_MODES,
  type TutorMode,
} from "../../lib/learner-types";
import { read } from "../../lib/mutate";
import { useLearnerMutation } from "./use-learner-mutation";

export interface Choice {
  id: string;
  label: string;
}

const isMode = (value: string): value is TutorMode =>
  TUTOR_MODES.some((m) => m === value);

/** Ouverture d'une séance avec le prof IA : mode, puis notion ou exercice. */
export function TutorNewSession({
  notions,
  exercises,
  initialMode,
  initialNotion,
  initialVariant,
}: {
  notions: Choice[];
  exercises: Choice[];
  initialMode: string | null;
  initialNotion: string | null;
  initialVariant: string | null;
}) {
  const t = useTranslations("learner.tutor");
  const router = useRouter();
  const { run, pending, error } = useLearnerMutation();
  const [mode, setMode] = useState<TutorMode>(
    initialMode && isMode(initialMode) ? initialMode : "course_question",
  );
  const [notionId, setNotionId] = useState(
    notions.some((n) => n.id === initialNotion) ? (initialNotion ?? "") : "",
  );
  const [variantId, setVariantId] = useState(
    exercises.some((e) => e.id === initialVariant)
      ? (initialVariant ?? "")
      : "",
  );

  const onExercise = EXERCISE_MODES.includes(mode);
  const onNotion = !onExercise && mode !== "intake";
  const ready =
    mode === "intake" ||
    (onExercise && variantId !== "") ||
    (onNotion && notionId !== "");

  async function start() {
    const body =
      mode === "intake"
        ? { mode }
        : onExercise
          ? { mode, variantId }
          : { mode, notionId };
    const result = await run("POST", "/learner/tutor/sessions", body, {
      refresh: false,
    });
    const id = result.ok ? read(read(result.data, "session"), "id") : null;
    if (typeof id === "string") router.push(`/eleve/prof-ia/${id}`);
  }

  return (
    <div className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="mb-3 font-medium">{t("mode")}</legend>
        <RadioGroup
          value={mode}
          onValueChange={(v) => {
            if (isMode(v)) setMode(v);
          }}
          className="gap-2"
        >
          {TUTOR_MODES.map((m) => (
            <Label
              key={m}
              htmlFor={`mode-${m}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:bg-muted"
            >
              <RadioGroupItem value={m} id={`mode-${m}`} className="mt-0.5" />
              <span className="space-y-0.5">
                <span className="block font-medium">{t(`modes.${m}`)}</span>
                <span className="block text-sm text-muted-foreground">
                  {t(`modeHelp.${m}`)}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </fieldset>

      {onNotion &&
        (notions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noNotions")}</p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="tutor-notion">{t("notion")}</Label>
            <NativeSelect
              id="tutor-notion"
              value={notionId}
              onChange={(e) => setNotionId(e.target.value)}
            >
              <NativeSelectOption value="">
                {t("notionPlaceholder")}
              </NativeSelectOption>
              {notions.map((n) => (
                <NativeSelectOption key={n.id} value={n.id}>
                  {n.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ))}

      {onExercise &&
        (exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noExercises")}</p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="tutor-exercise">{t("exercise")}</Label>
            <NativeSelect
              id="tutor-exercise"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
            >
              <NativeSelectOption value="">
                {t("exercisePlaceholder")}
              </NativeSelectOption>
              {exercises.map((e) => (
                <NativeSelectOption key={e.id} value={e.id}>
                  {e.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ))}

      <Button size="lg" onClick={start} disabled={!ready || pending}>
        {t("start")}
      </Button>
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
