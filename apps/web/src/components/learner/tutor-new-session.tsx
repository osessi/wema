"use client";

import { ArrowRight, Path, PencilSimpleLine } from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/brand";
import { Button } from "@wema/ui/components/ui/button";
import { Label } from "@wema/ui/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@wema/ui/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@wema/ui/components/ui/radio-group";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
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
import { MODE_VISUALS } from "./visuals";

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

  // Récapitulatif replié si le lien apporte déjà le mode et son sujet.
  const [picking, setPicking] = useState(
    !(
      initialMode !== null &&
      isMode(initialMode) &&
      (initialMode === "intake" ||
        (EXERCISE_MODES.includes(initialMode)
          ? exercises.some((e) => e.id === initialVariant)
          : notions.some((n) => n.id === initialNotion)))
    ),
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

  const Current = MODE_VISUALS[mode];
  const chosen = onExercise
    ? exercises.find((e) => e.id === variantId)?.label
    : onNotion
      ? notions.find((n) => n.id === notionId)?.label
      : undefined;

  const action = (
    <div className="space-y-2">
      <Button
        variant="brand"
        size="lg"
        className="w-full"
        onClick={start}
        disabled={!ready || pending}
      >
        {t("start")}
        <ArrowRight aria-hidden />
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );

  // Arrivée depuis l'accueil ou un exercice, avec mode et sujet déjà choisis :
  // un récapitulatif et « Commencer » en haut, les autres modes repliés.
  if (!picking)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-card border bg-surface p-4">
          <GlowTile tone={Current.tone} size={48}>
            <Current.icon weight="fill" />
          </GlowTile>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {t("ready")}
            </p>
            <p className="font-medium">{t(`modes.${mode}`)}</p>
            {chosen && (
              <p className="truncate text-sm text-muted-foreground">{chosen}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
            {t("change")}
          </Button>
        </div>
        {action}
      </div>
    );

  return (
    <div className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="mb-3 font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {t("mode")}
        </legend>
        <RadioGroup
          value={mode}
          onValueChange={(v) => {
            if (isMode(v)) setMode(v);
          }}
          className="gap-2"
        >
          {TUTOR_MODES.map((m) => {
            const { icon: Glyph, tone } = MODE_VISUALS[m];
            return (
              <Label
                key={m}
                htmlFor={`mode-${m}`}
                className="flex cursor-pointer items-center gap-3 rounded-card border bg-card p-3 font-normal transition-colors hover:border-foreground/25 has-[[data-state=checked]]:border-foreground/80 has-[[data-state=checked]]:bg-surface-subtle has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
              >
                <GlowTile tone={tone} size={36}>
                  <Glyph weight="fill" />
                </GlowTile>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block font-medium">{t(`modes.${m}`)}</span>
                  <span className="block text-sm text-muted-foreground">
                    {t(`modeHelp.${m}`)}
                  </span>
                </span>
                <RadioGroupItem value={m} id={`mode-${m}`} />
              </Label>
            );
          })}
        </RadioGroup>
      </fieldset>

      {onNotion &&
        (notions.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<Path weight="fill" />}
            title={t("noNotions")}
          />
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
          <EmptyState
            variant="inline"
            icon={<PencilSimpleLine weight="fill" />}
            title={t("noExercises")}
          />
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

      {action}
    </div>
  );
}
