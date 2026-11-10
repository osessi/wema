"use client";

import {
  ArrowRight,
  CheckCircle,
  HandPalm,
  Hourglass,
  type Icon,
  ListNumbers,
  Path,
  Question,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react";
import type { GlowTone } from "@wema/ui/brand";
import { GlowTile, TsfFrame } from "@wema/ui/brand";
import { Button } from "@wema/ui/components/ui/button";
import { CARD_INNER_SHADOW, CardShell } from "@wema/ui/components/ui/card";
import { Label } from "@wema/ui/components/ui/label";
import { Progress } from "@wema/ui/components/ui/progress";
import { Spinner } from "@wema/ui/components/ui/spinner";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
import { cn } from "@wema/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { browserApi } from "../../lib/insights-client";
import type { PlacementQuestion } from "../../lib/placement-types";
import { MathInput, MathText } from "./math";
import { useLearnerMutation } from "./use-learner-mutation";

type Loaded = Extract<PlacementQuestion, { done: false }>;

/** Les trois promesses de l'introduction, chacune avec sa pastille. */
const INTRO_POINTS: {
  key: "one" | "noCorrection" | "adaptive";
  icon: Icon;
  tone: GlowTone;
}[] = [
  { key: "one", icon: ListNumbers, tone: "sky" },
  { key: "noCorrection", icon: ShieldCheck, tone: "mint" },
  { key: "adaptive", icon: Sparkle, tone: "rose" },
];

/** Surface intérieure posée dans une `CardShell`. */
const INNER = cn("rounded-card border bg-card", CARD_INNER_SHADOW);

/**
 * Déroulé du test de niveau : une introduction bienveillante, puis une
 * question à la fois avec une barre d'avancement. Aucune correction n'est
 * affichée pendant le test ; à la fin, la page se recharge sur le bilan.
 */
export function PlacementRunner({
  subjectId,
  subjectIcon,
  started,
}: {
  subjectId: string;
  /** Icône de la matière, en tête de l'introduction. */
  subjectIcon?: string | null | undefined;
  /** Vrai si un test est déjà en cours : on reprend sans l'introduction. */
  started: boolean;
}) {
  const t = useTranslations("learner.placement");
  const te = useTranslations("learner.errors");
  const router = useRouter();
  const { run, pending, error, setError } = useLearnerMutation();
  const [stage, setStage] = useState<"intro" | "test" | "finishing">(
    started ? "test" : "intro",
  );
  const [current, setCurrent] = useState<Loaded | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await browserApi().learner.placement[
        ":subjectId"
      ].question.$get({ param: { subjectId } });
      const data = await res.json();
      if ("question" in data) {
        setCurrent(data);
        setAnswer("");
      } else if ("done" in data) {
        setStage("finishing");
        router.refresh();
      } else {
        const code = "code" in data.error ? data.error.code : "generic";
        setError(te.has(code) ? te(code) : te("generic"));
      }
    } catch {
      setError(te("network"));
    } finally {
      setLoading(false);
    }
  }, [subjectId, router, setError, te]);

  useEffect(() => {
    if (stage === "test" && current === null) void load();
  }, [stage, current, load]);

  async function start() {
    const result = await run(
      "POST",
      `/learner/placement/${subjectId}/start`,
      undefined,
      { refresh: false },
    );
    if (result.ok) setStage("test");
  }

  async function send(response: string | null) {
    if (!current) return;
    const result = await run(
      "POST",
      `/learner/placement/${subjectId}/answer`,
      { itemId: current.question.id, response },
      { refresh: false },
    );
    // Déjà répondue (autre onglet) : on passe simplement à la suivante.
    if (result.ok || result.code === "already_answered") await load();
  }

  if (stage === "intro")
    return (
      <TsfFrame innerClassName="space-y-5 p-5 sm:p-7">
        <div className="flex items-start gap-4">
          {subjectIcon !== undefined ? (
            <SubjectIcon icon={subjectIcon} size={56} />
          ) : (
            <GlowTile tone="yellow" size={56} idle="breathe">
              <Path weight="fill" />
            </GlowTile>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-2xl font-medium tracking-tight">
              {t("introTitle")}
            </h2>
            <p className="text-muted-foreground">{t("introText")}</p>
          </div>
        </div>
        <ul className="grid gap-2.5 sm:grid-cols-3">
          {INTRO_POINTS.map(({ key, icon: Glyph, tone }) => (
            <li
              key={key}
              className="flex items-start gap-3 rounded-card border bg-card p-3 text-sm shadow-xs sm:flex-col"
            >
              <GlowTile tone={tone} size={32}>
                <Glyph weight="bold" />
              </GlowTile>
              <span className="min-w-0 text-pretty">
                {t(`introPoints.${key}`)}
              </span>
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          variant="bevel"
          className="w-full sm:w-auto"
          onClick={start}
          disabled={pending}
        >
          {t("start")}
          <ArrowRight aria-hidden weight="bold" />
        </Button>
      </TsfFrame>
    );

  if (stage === "finishing" || (loading && current === null))
    return (
      <CardShell>
        <div role="status" className={cn("flex items-center gap-3 p-5", INNER)}>
          <Spinner />
          <span>{stage === "finishing" ? t("finishing") : t("loading")}</span>
        </div>
      </CardShell>
    );

  if (!current)
    return (
      <div className="space-y-3">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button variant="outline" onClick={() => void load()}>
          {t("retry")}
        </Button>
      </div>
    );

  const { progress, question } = current;
  const percent =
    progress.total > 0
      ? Math.round((progress.answered / progress.total) * 100)
      : 0;
  const busy = pending || loading;

  return (
    <div className="space-y-5">
      <CardShell tone="sky">
        <div className={cn("space-y-5 p-5 sm:p-6", INNER)}>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                {t("question", { index: progress.answered + 1 })}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {t("progress", {
                  answered: progress.answered,
                  total: progress.total,
                })}
              </span>
            </div>
            <Progress
              value={percent}
              aria-label={t("progressLabel")}
              aria-valuetext={t("progress", {
                answered: progress.answered,
                total: progress.total,
              })}
            />
          </div>

          <section aria-live="polite" className="flex items-start gap-4">
            <GlowTile tone="sky" size={44}>
              <Question weight="bold" />
            </GlowTile>
            <p className="min-w-0 flex-1 pt-1.5 text-lg text-pretty">
              <MathText
                text={question.statement}
                rendered={question.rendered}
              />
            </p>
          </section>
        </div>
      </CardShell>

      <CardShell>
        <section className={cn("space-y-3 p-4 sm:p-5", INNER)}>
          <div className="space-y-1">
            <Label htmlFor="placement-answer" className="text-base font-medium">
              {t("answer")}
            </Label>
            <p className="text-sm text-muted-foreground">{t("answerHelp")}</p>
          </div>
          <MathInput
            key={question.id}
            id="placement-answer"
            disabled={busy}
            onChange={setAnswer}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => void send(null)}
              disabled={busy}
            >
              <HandPalm aria-hidden />
              {t("dontKnow")}
            </Button>
            <Button
              variant="brand"
              size="lg"
              onClick={() => void send(answer)}
              disabled={busy || answer.length === 0}
            >
              {busy ? (
                <Hourglass aria-hidden />
              ) : (
                <CheckCircle aria-hidden weight="bold" />
              )}
              {busy ? t("sending") : t("next")}
            </Button>
          </div>
        </section>
      </CardShell>
    </div>
  );
}
