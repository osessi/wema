"use client";

import { Card, CardContent } from "@wema/ui/components/ui/card";
import { Label } from "@wema/ui/components/ui/label";
import { Switch } from "@wema/ui/components/ui/switch";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import type { EasyReadingContent } from "../../lib/formats-types";
import { MathText } from "../learner/math";
import { ListenButton } from "../learner/voice/listen-button";
import { useCanSpeak } from "../learner/voice/speech";

type Rendered = Record<string, { text: string; latex: string }>;

/** Énoncé en texte, tel que vérifié par services/math. */
export function TextStatement({
  statement,
  rendered,
}: {
  statement: string;
  rendered: Rendered;
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-lg leading-relaxed">
          <MathText text={statement} rendered={rendered} />
        </p>
      </CardContent>
    </Card>
  );
}

/** Lecture facile : police Lexend, phrases courtes une par ligne, grand interligne. */
export function EasyReadingView({
  content,
  rendered,
}: {
  content: EasyReadingContent;
  rendered: Rendered;
}) {
  return (
    <Card>
      <CardContent>
        <ol className="list-none space-y-4 p-0 font-easy text-xl leading-loose tracking-wide [word-spacing:0.12em]">
          {content.sentences.map((s, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: phrases d'un énoncé, ordre fixe
            <li key={i} className="max-w-prose">
              <MathText text={s} rendered={rendered} />
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

const AUTO_KEY = "wema.formats.audioAuto";

function readAuto(): boolean {
  try {
    return window.localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

/** Format audio : l'énoncé lu à voix haute (voix du navigateur), lecture automatique au choix. */
export function AudioView({
  statement,
  rendered,
}: {
  statement: string;
  rendered: Rendered;
}) {
  const t = useTranslations("formats.audio");
  const id = useId();
  const canSpeak = useCanSpeak();
  const [auto, setAuto] = useState<boolean | null>(null);
  useEffect(() => setAuto(readAuto()), []);

  if (!canSpeak)
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
        <TextStatement statement={statement} rendered={rendered} />
      </div>
    );
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{t("intro")}</p>
          {auto !== null && (
            <ListenButton
              text={statement}
              label={t("listen")}
              autoStart={auto}
            />
          )}
          <div className="flex items-center gap-2">
            <Switch
              id={`${id}-auto`}
              checked={auto === true}
              onCheckedChange={(v) => {
                setAuto(v);
                try {
                  window.localStorage.setItem(AUTO_KEY, v ? "1" : "0");
                } catch {
                  // Réglage valable pour cette page seulement.
                }
              }}
            />
            <Label htmlFor={`${id}-auto`}>{t("auto")}</Label>
          </div>
        </CardContent>
      </Card>
      <TextStatement statement={statement} rendered={rendered} />
    </div>
  );
}
