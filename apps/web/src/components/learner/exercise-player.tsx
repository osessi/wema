"use client";

import {
  ArrowCounterClockwise,
  ArrowRight,
  ChatsCircle,
  CheckCircle,
  Footprints,
  Lightbulb,
  Microphone,
  PaperPlaneTilt,
  Trophy,
} from "@phosphor-icons/react";
import { GlowTile, TsfFrame } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { CARD_INNER_SHADOW, CardShell } from "@wema/ui/components/ui/card";
import { Label } from "@wema/ui/components/ui/label";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { AssignmentStatus, Variant } from "../../lib/learner-types";
import { read } from "../../lib/mutate";
import { encourage } from "./encouragement";
import { MathInput } from "./math";
import { useLearnerMutation } from "./use-learner-mutation";

interface Feedback {
  correct: boolean;
  reason: string | null;
  attemptsLeft: number;
}

function toFeedback(data: unknown): Feedback | null {
  const correct = read(data, "correct");
  const reason = read(data, "reason");
  const attemptsLeft = read(data, "attemptsLeft");
  if (typeof correct !== "boolean" || typeof attemptsLeft !== "number")
    return null;
  return {
    correct,
    reason: typeof reason === "string" ? reason : null,
    attemptsLeft,
  };
}

/**
 * Exercice d'un élève : étapes guidées révélées une à une, réponse saisie
 * dans un champ mathématique et vérifiée par services/math. On dit
 * seulement si c'est juste : la bonne réponse n'est jamais affichée.
 */
export function ExercisePlayer({
  variant,
  status,
  format,
  extraHints = 0,
}: {
  variant: Variant;
  status: AssignmentStatus | null;
  /** Format dans lequel l'élève lit l'énoncé, envoyé avec la réponse (mesure de ce qui marche). */
  format?: string;
  /** Aides utilisées hors des étapes (manipulables), comptées comme indices. */
  extraHints?: number;
}) {
  const t = useTranslations("learner.exercises");
  const initialSteps = variant.scaffolded
    ? variant.steps.length
    : Math.min(variant.hintLevel, variant.steps.length);
  // Pas à pas : les étapes se révèlent une à une (la première est offerte) ;
  // elles ne comptent pas comme indices sur un exercice guidé.
  const [shown, setShown] = useState(
    variant.scaffolded ? Math.min(1, variant.steps.length) : initialSteps,
  );
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const { run, pending, error } = useLearnerMutation();

  const solved = feedback?.correct === true || status === "done";
  const answered =
    feedback !== null || status === "done" || status === "attempted";
  const blocked = solved || exhausted || feedback?.attemptsLeft === 0;

  async function submit() {
    if (answer.length === 0) return;
    const result = await run("POST", `/learner/variants/${variant.id}/answer`, {
      response: answer,
      hintsUsed: Math.min(10, Math.max(0, shown - initialSteps) + extraHints),
      ...(format ? { format } : {}),
    });
    if (result.ok) {
      const next = toFeedback(result.data);
      setFeedback(next);
      if (next?.correct) encourage("success");
    } else if (result.code === "attempts_exhausted") setExhausted(true);
  }

  const tutorHref = (mode: string) =>
    `/eleve/prof-ia?mode=${mode}&variant=${variant.id}`;

  return (
    <div className="space-y-6">
      {variant.steps.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            <Footprints aria-hidden className="size-3.5" />
            {t("steps")}
          </h2>
          {shown > 0 && (
            <ol className="space-y-2">
              {variant.steps.slice(0, shown).map((step, i) => (
                <li
                  key={step}
                  className="flex items-start gap-3 rounded-card border bg-card p-3 shadow-xs motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-300"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-xs font-semibold text-brand-text tabular-nums">
                    <span className="sr-only">
                      {t("stepLabel", { index: i + 1 })}
                    </span>
                    <span aria-hidden>{i + 1}</span>
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          )}
          {shown < variant.steps.length ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShown((n) => n + 1)}
            >
              <Lightbulb aria-hidden />
              {t("nextStep")}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noMoreSteps")}</p>
          )}
        </section>
      )}

      <CardShell>
        <section
          className={cn(
            "space-y-3 rounded-card border bg-card p-4 sm:p-5",
            CARD_INNER_SHADOW,
          )}
        >
          <div className="space-y-1">
            <Label htmlFor="answer" className="text-base font-medium">
              {t("answer")}
            </Label>
            <p className="text-sm text-muted-foreground">{t("answerHelp")}</p>
          </div>
          <MathInput id="answer" disabled={blocked} onChange={setAnswer} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {!blocked && (
            <div className="flex justify-end">
              <Button
                variant="brand"
                size="lg"
                className="w-full sm:w-auto"
                onClick={submit}
                disabled={pending || answer.length === 0}
              >
                <CheckCircle aria-hidden weight="bold" />
                {pending ? t("checking") : t("submit")}
              </Button>
            </div>
          )}
        </section>
      </CardShell>

      <div aria-live="polite">
        {feedback?.correct && (
          <TsfFrame innerClassName="bg-[radial-gradient(120%_140%_at_0%_0%,var(--status-mastered)_0%,transparent_65%)] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <GlowTile tone="mint" size={56} idle="breathe">
                <Trophy weight="fill" />
              </GlowTile>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xl font-medium tracking-tight">
                  {t("correct")}
                </p>
                <p className="text-muted-foreground">{t("correctHint")}</p>
              </div>
              <Button asChild variant="bevel" className="w-full sm:w-auto">
                <Link href="/eleve">
                  {t("continue")}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </TsfFrame>
        )}
        {feedback && !feedback.correct && (
          <div className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning-soft p-4 text-warning-text">
            <GlowTile tone="amber" size={36}>
              <ArrowCounterClockwise weight="bold" />
            </GlowTile>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium">{t("notYet")}</p>
              <p className="text-sm text-foreground">
                {feedback.reason === "wrong_form"
                  ? t("wrongForm")
                  : t("notYetHint")}
              </p>
              <Badge
                variant={feedback.attemptsLeft === 0 ? "danger" : "warning"}
                className="mt-1 whitespace-normal"
              >
                {feedback.attemptsLeft === 0
                  ? t("noAttemptsLeft")
                  : t("attemptsLeft", { count: feedback.attemptsLeft })}
              </Badge>
            </div>
          </div>
        )}
        {!feedback && status === "done" && (
          <div className="flex flex-col gap-4 rounded-card border border-success/30 bg-success-soft p-4 sm:flex-row sm:items-center">
            <GlowTile tone="mint" size={40}>
              <CheckCircle weight="fill" />
            </GlowTile>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-medium text-success-text">
                {t("alreadyDone")}
              </p>
              <p className="text-sm text-foreground/80">{t("doneHint")}</p>
            </div>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/eleve/exercices">
                {t("toList")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        )}
        {!feedback && status === "attempted" && (
          <div className="flex items-start gap-3 rounded-card border border-info/30 bg-info-soft p-4">
            <GlowTile tone="sky" size={40}>
              <PaperPlaneTilt weight="fill" />
            </GlowTile>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-medium text-info-text">
                {t("alreadyAttempted")}
              </p>
              <p className="text-sm text-foreground/80">{t("attemptedHint")}</p>
            </div>
          </div>
        )}
      </div>

      {(!solved || answered) && (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
          {!solved && (
            <Button asChild variant="ghost" size="sm">
              <Link href={tutorHref("exercise_help")}>
                <ChatsCircle aria-hidden />
                {t("askTutor")}
              </Link>
            </Button>
          )}
          {answered && (
            <Button asChild variant="ghost" size="sm">
              <Link href={tutorHref("oral_check")}>
                <Microphone aria-hidden />
                {t("explainOral")}
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
