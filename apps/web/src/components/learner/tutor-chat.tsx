"use client";

import { Lightbulb, PaperPlaneRight, StopCircle } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { Textarea } from "@wema/ui/components/ui/textarea";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { TutorMode } from "../../lib/learner-types";
import { read } from "../../lib/mutate";
import { useLearnerMutation } from "./use-learner-mutation";

/** Indices au plus par séance (même borne que l'API). */
const MAX_HINTS = 3;

interface ChatMessage {
  id: string;
  role: "learner" | "tutor";
  content: string;
  guarded: boolean;
}

interface Outcome {
  assessment: { understanding: number; confidence: number } | null;
  hypotheses: number | null;
}

const text = (v: unknown) => (typeof v === "string" ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : null);

/** Conversation avec le prof IA : messages, indices (aide sur un exercice), fin de séance. */
export function TutorChat({
  sessionId,
  mode,
  open,
  hintLevel,
  variantId,
  initialMessages,
}: {
  sessionId: string;
  mode: TutorMode;
  open: boolean;
  hintLevel: number;
  variantId: string | null;
  initialMessages: ChatMessage[];
}) {
  const t = useTranslations("learner.tutor.chat");
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState<string | null>(null);
  const [hints, setHints] = useState(hintLevel);
  const [finished, setFinished] = useState(!open);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const { run, pending, error } = useLearnerMutation();
  const end = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: on suit l'arrivée des messages
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, waiting]);

  async function send() {
    const content = draft.trim();
    if (!content || pending) return;
    setWaiting(content);
    setDraft("");
    const result = await run(
      "POST",
      `/learner/tutor/sessions/${sessionId}/messages`,
      { content },
      { refresh: false },
    );
    setWaiting(null);
    if (!result.ok) {
      setDraft(content);
      if (result.code === "session_finished") setFinished(true);
      return;
    }
    const message = read(result.data, "message");
    setMessages((list) => [
      ...list,
      { id: `local-${list.length}`, role: "learner", content, guarded: false },
      {
        id: text(read(message, "id")) ?? `local-${list.length + 1}`,
        role: "tutor",
        content: text(read(message, "content")) ?? "",
        guarded: false,
      },
    ]);
  }

  async function hint() {
    const result = await run(
      "POST",
      `/learner/tutor/sessions/${sessionId}/hint`,
      undefined,
      { refresh: false },
    );
    if (!result.ok) {
      if (result.code === "hints_exhausted") setHints(MAX_HINTS);
      return;
    }
    const message = read(result.data, "message");
    setHints(num(read(result.data, "level")) ?? hints + 1);
    setMessages((list) => [
      ...list,
      {
        id: text(read(message, "id")) ?? `local-${list.length}`,
        role: "tutor",
        content: text(read(message, "content")) ?? "",
        guarded: false,
      },
    ]);
  }

  async function finish() {
    const result = await run(
      "POST",
      `/learner/tutor/sessions/${sessionId}/finish`,
    );
    if (!result.ok) {
      if (result.code === "session_finished") setFinished(true);
      return;
    }
    const assessment = read(result.data, "assessment");
    const hypotheses = read(result.data, "hypotheses");
    const understanding = num(read(assessment, "understanding"));
    const confidence = num(read(assessment, "confidence"));
    setFinished(true);
    setOutcome({
      assessment:
        understanding !== null && confidence !== null
          ? { understanding, confidence }
          : null,
      hypotheses: Array.isArray(hypotheses) ? hypotheses.length : null,
    });
  }

  const percent = (v: number) => Math.round(v * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3" aria-live="polite">
        {messages.length === 0 && !waiting && (
          <p className="text-muted-foreground">{t("empty")}</p>
        )}
        {messages.map((m) => (
          <Bubble
            key={m.id}
            from={m.role}
            label={t(m.role === "learner" ? "you" : "tutor")}
          >
            {m.content}
            {m.guarded && (
              <span className="mt-2 block text-xs text-muted-foreground">
                {t("guarded")}
              </span>
            )}
          </Bubble>
        ))}
        {waiting && (
          <>
            <Bubble from="learner" label={t("you")}>
              {waiting}
            </Bubble>
            <p className="text-sm text-muted-foreground">{t("sending")}</p>
          </>
        )}
        <div ref={end} />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border bg-muted p-3 text-sm">
          {error}
        </p>
      )}

      {finished ? (
        <div className="space-y-3 rounded-xl border bg-muted p-4">
          <p className="font-medium">{t("finished")}</p>
          {outcome?.assessment && (
            <p>
              {t("assessment", {
                understanding: percent(outcome.assessment.understanding),
                confidence: percent(outcome.assessment.confidence),
              })}
            </p>
          )}
          {outcome?.hypotheses !== null &&
            outcome?.hypotheses !== undefined && (
              <p>{t("intakeDone", { count: outcome.hypotheses })}</p>
            )}
          <div className="flex flex-wrap gap-2">
            {mode === "intake" && (
              <Button asChild variant="outline" size="sm">
                <Link href="/eleve/profil">{t("seeProfile")}</Link>
              </Button>
            )}
            {variantId && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/eleve/exercices/${variantId}`}>
                  {t("goExercise")}
                </Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Textarea
            value={draft}
            maxLength={2000}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending || draft.trim() === ""}>
              <PaperPlaneRight />
              {t("send")}
            </Button>
            {mode === "exercise_help" && (
              <Button
                type="button"
                variant="outline"
                disabled={pending || hints >= MAX_HINTS}
                onClick={hint}
              >
                <Lightbulb />
                {t("hint")}
                <span className="text-muted-foreground">
                  ({t("hintsLeft", { count: Math.max(0, MAX_HINTS - hints) })})
                </span>
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={finish}
              className="ml-auto"
            >
              <StopCircle />
              {t("finish")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Bubble({
  from: role,
  label,
  children,
}: {
  from: "learner" | "tutor";
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        role === "learner" ? "items-end" : "items-start",
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2 whitespace-pre-wrap",
          role === "learner" ? "bg-muted" : "border bg-card",
        )}
      >
        {children}
      </div>
    </div>
  );
}
