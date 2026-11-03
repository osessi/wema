"use client";

import {
  ChatsCircle,
  CheckCircle,
  Footprints,
  Lightbulb,
  Microphone,
} from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { Label } from "@wema/ui/components/ui/label";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { AssignmentStatus, Variant } from "../../lib/learner-types";
import { read } from "../../lib/mutate";
import { MathInput } from "./math";
import { useLearnerMutation } from "./use-learner-mutation";
import { ListenButton } from "./voice/listen-button";

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
}: {
  variant: Variant;
  status: AssignmentStatus | null;
}) {
  const t = useTranslations("learner.exercises");
  const tVoice = useTranslations("learner.voice");
  const initialSteps = variant.scaffolded
    ? variant.steps.length
    : Math.min(variant.hintLevel, variant.steps.length);
  const [shown, setShown] = useState(initialSteps);
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
      hintsUsed: Math.max(0, shown - initialSteps),
    });
    if (result.ok) setFeedback(toFeedback(result.data));
    else if (result.code === "attempts_exhausted") setExhausted(true);
  }

  const tutorHref = (mode: string) =>
    `/eleve/prof-ia?mode=${mode}&variant=${variant.id}`;

  return (
    <div className="space-y-6">
      <div className="-mt-4 -ml-2">
        <ListenButton
          text={variant.statement}
          label={tVoice("listenStatement")}
        />
      </div>
      {variant.steps.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <Footprints />
            {t("steps")}
          </h2>
          {shown > 0 && (
            <ol className="list-decimal space-y-2 pl-6">
              {variant.steps.slice(0, shown).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
          {shown < variant.steps.length ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShown((n) => n + 1)}
            >
              <Lightbulb />
              {t("nextStep")}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noMoreSteps")}</p>
          )}
        </section>
      )}

      <section className="space-y-3">
        <Label htmlFor="answer" className="font-display text-xl font-bold">
          {t("answer")}
        </Label>
        <p className="text-sm text-muted-foreground">{t("answerHelp")}</p>
        <MathInput id="answer" disabled={blocked} onChange={setAnswer} />
        {!blocked && (
          <Button
            size="lg"
            onClick={submit}
            disabled={pending || answer.length === 0}
          >
            {pending ? t("checking") : t("submit")}
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
      </section>

      <div aria-live="polite">
        {feedback?.correct && (
          <div className="flex items-start gap-3 rounded-xl border border-brand bg-brand-soft p-4">
            <CheckCircle className="mt-0.5 size-6 shrink-0" weight="fill" />
            <div>
              <p className="font-display text-lg font-bold">{t("correct")}</p>
              <p>{t("correctHint")}</p>
              <Button asChild size="sm" className="mt-3">
                <Link href="/eleve">{t("continue")}</Link>
              </Button>
            </div>
          </div>
        )}
        {feedback && !feedback.correct && (
          <div className="space-y-1 rounded-xl border bg-muted p-4">
            <p className="font-display text-lg font-bold">{t("notYet")}</p>
            <p>
              {feedback.reason === "wrong_form"
                ? t("wrongForm")
                : t("notYetHint")}
            </p>
            <p className="text-sm text-muted-foreground">
              {feedback.attemptsLeft === 0
                ? t("noAttemptsLeft")
                : t("attemptsLeft", { count: feedback.attemptsLeft })}
            </p>
          </div>
        )}
        {!feedback && status === "done" && (
          <p className="rounded-xl border bg-muted p-4">{t("alreadyDone")}</p>
        )}
        {!feedback && status === "attempted" && (
          <p className="rounded-xl border bg-muted p-4">
            {t("alreadyAttempted")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {!solved && (
          <Button asChild variant="outline">
            <Link href={tutorHref("exercise_help")}>
              <ChatsCircle />
              {t("askTutor")}
            </Link>
          </Button>
        )}
        {answered && (
          <Button asChild variant="outline">
            <Link href={tutorHref("oral_check")}>
              <Microphone />
              {t("explainOral")}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
