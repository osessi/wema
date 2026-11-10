"use client";

import { HandGrabbing } from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/brand";
import { Button } from "@wema/ui/components/ui/button";
import { Card, CardContent } from "@wema/ui/components/ui/card";
import { Skeleton } from "@wema/ui/components/ui/skeleton";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import type {
  ComicsContent,
  EasyReadingContent,
  Presentation,
  PresentationFormat,
} from "../../lib/formats-types";
import type { AssignmentStatus, Variant } from "../../lib/learner-types";
import { ExercisePlayer } from "../learner/exercise-player";
import { ListenButton } from "../learner/voice/listen-button";
import { BalanceManipulable } from "./balance-manipulable";
import { renderVariant } from "./client";
import { Comics } from "./comics";
import { Figure } from "./figure";
import { FormatPicker } from "./format-picker";
import { PythagorasManipulable } from "./pythagoras-manipulable";
import { AudioView, EasyReadingView, TextStatement } from "./statement-views";

/**
 * Énoncé d'une variante dans le format conseillé par le cœur (choosePresentation),
 * que l'élève peut changer ; aide à manipuler si l'exercice en a une ; puis
 * le lecteur d'exercice, qui envoie le format lu avec la réponse.
 */
export function ExerciseFormats({
  variant,
  presentation,
  status,
}: {
  variant: Variant;
  presentation: Presentation;
  status: AssignmentStatus | null;
}) {
  const t = useTranslations("formats");
  const tLearner = useTranslations("learner");
  const [format, setFormat] = useState<PresentationFormat>(presentation.format);
  const [comics, setComics] = useState<ComicsContent | null>(
    presentation.comics,
  );
  const [easy, setEasy] = useState<EasyReadingContent>(
    presentation.easyReading,
  );
  const [adapted, setAdapted] = useState(presentation.easyReadingAdapted);
  const [failed, setFailed] = useState<PresentationFormat[]>([]);
  const [loading, setLoading] = useState(false);
  const [aidOpen, setAidOpen] = useState(false);
  const [aidsUsed, setAidsUsed] = useState(0);

  // BD et lecture facile reformulées par l'IA à la demande (puis gardées en cache par l'API).
  useEffect(() => {
    const need =
      (format === "comics" && comics === null && !failed.includes("comics")) ||
      (format === "easy_reading" &&
        !adapted &&
        !failed.includes("easy_reading"));
    if (!need || (format !== "comics" && format !== "easy_reading")) return;
    let alive = true;
    setLoading(true);
    renderVariant(variant.id, format).then((r) => {
      if (!alive) return;
      setLoading(false);
      if (r?.status === "ok" && r.comics) setComics(r.comics);
      else if (r?.status === "ok" && r.easyReading) {
        setEasy(r.easyReading);
        setAdapted(true);
      } else setFailed((f) => [...f, format]);
    });
    return () => {
      alive = false;
    };
  }, [format, comics, adapted, failed, variant.id]);

  const text = (
    <TextStatement statement={variant.statement} rendered={variant.rendered} />
  );
  let body: ReactNode;
  switch (format) {
    case "text":
      body = text;
      break;
    case "audio":
      body = (
        <AudioView statement={variant.statement} rendered={variant.rendered} />
      );
      break;
    case "easy_reading":
      body = <EasyReadingView content={easy} rendered={variant.rendered} />;
      break;
    case "diagram":
      body = (
        <div className="space-y-3">
          {text}
          {presentation.figure && (
            <Card>
              <CardContent className="flex justify-center">
                <Figure figure={presentation.figure} />
              </CardContent>
            </Card>
          )}
        </div>
      );
      break;
    case "comics":
      body =
        comics !== null ? (
          <div className="space-y-3">
            <Comics comics={comics} rendered={variant.rendered} />
            <details className="rounded-card border bg-card p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {t("showText")}
              </summary>
              <div className="mt-3">{text}</div>
            </details>
          </div>
        ) : loading ? (
          <div className="space-y-3" aria-busy="true">
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="aspect-[4/3] rounded-card" />
              <Skeleton className="aspect-[4/3] rounded-card" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("fallback")}</p>
            {text}
          </div>
        );
      break;
  }

  const figure = presentation.figure;
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {t("picker.label")}
        </h2>
        <FormatPicker
          formats={presentation.formats}
          value={format}
          recommended={presentation.format}
          label={t("picker.label")}
          onChange={setFormat}
        />
        <p className="text-xs text-muted-foreground">
          {format === presentation.format
            ? t(`reason.${presentation.reason}`)
            : t("sameExercise")}
        </p>
      </section>
      <section className="space-y-2">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <h2 className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {tLearner("exercises.statement")}
          </h2>
          {/* En format audio, la vue de l'énoncé a déjà son bouton « Écouter ». */}
          {format !== "audio" && (
            <ListenButton
              text={variant.statement}
              label={tLearner("voice.listenStatement")}
            />
          )}
        </div>
        <div aria-live="polite">{body}</div>
      </section>

      {presentation.manipulable && figure && (
        <section className="space-y-4 rounded-card border bg-card p-4 shadow-xs sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <GlowTile tone="sky" size={40}>
              <HandGrabbing weight="fill" />
            </GlowTile>
            <div className="min-w-0 flex-1">
              <h2 className="font-medium">{t("aid.title")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("aid.description")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-expanded={aidOpen}
              onClick={() => setAidOpen((o) => !o)}
            >
              {aidOpen ? t("aid.close") : t("aid.open")}
            </Button>
          </div>
          {aidOpen && figure.kind === "balance" && (
            <BalanceManipulable
              left={figure.left}
              right={figure.right}
              variable={figure.variable}
              onUse={() => setAidsUsed((n) => n + 1)}
            />
          )}
          {aidOpen && figure.kind === "right_triangle" && (
            <PythagorasManipulable
              legs={figure.legs}
              hypotenuse={figure.hypotenuse}
              onUse={() => setAidsUsed((n) => n + 1)}
            />
          )}
        </section>
      )}

      <ExercisePlayer
        variant={variant}
        status={status}
        format={format}
        extraHints={aidsUsed}
      />
    </div>
  );
}
