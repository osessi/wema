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
import { streamTutorMessage } from "./tutor-stream";
import { useLearnerMutation } from "./use-learner-mutation";
import { DictateButton } from "./voice/dictate-button";
import { ListenButton } from "./voice/listen-button";

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

/** Réponse en cours : message de l'élève, texte reçu et texte déjà affiché. */
interface Pending {
  learner: string;
  received: string;
  shown: number;
  /** Messages enregistrés, ajoutés à la conversation une fois tout le texte affiché. */
  saved?: ChatMessage[];
}

const text = (v: unknown) => (typeof v === "string" ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : null);

/**
 * Conversation avec le prof IA : réponses affichées au fil de l'eau, voix
 * (« Écouter », « Dicter »), indices (aide sur un exercice), fin de séance.
 */
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
  const tErrors = useTranslations("learner.errors");
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [hints, setHints] = useState(hintLevel);
  const [finished, setFinished] = useState(!open);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const { run, pending: busy, error } = useLearnerMutation();
  const end = useRef<HTMLDivElement>(null);
  const beforeDictation = useRef("");
  const oral = mode === "oral_check";

  // biome-ignore lint/correctness/useExhaustiveDependencies: on suit l'arrivée du texte
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending?.shown, pending === null]);

  // Affichage progressif : le texte reçu se dévoile peu à peu, qu'il arrive
  // par petits morceaux ou d'un seul bloc (réponse contrôlée avant envoi).
  const catchingUp =
    pending !== null && pending.shown < pending.received.length;
  useEffect(() => {
    if (!catchingUp) return;
    const timer = window.setInterval(() => {
      setPending((p) =>
        p
          ? {
              ...p,
              shown: Math.min(
                p.received.length,
                p.shown +
                  Math.max(2, Math.ceil((p.received.length - p.shown) / 12)),
              ),
            }
          : p,
      );
    }, 30);
    return () => window.clearInterval(timer);
  }, [catchingUp]);

  useEffect(() => {
    if (!pending?.saved || pending.shown < pending.received.length) return;
    const saved = pending.saved;
    setMessages((list) => [...list, ...saved]);
    setPending(null);
  }, [pending]);

  const working = busy || pending !== null;

  async function send() {
    const content = draft.trim();
    if (!content || working) return;
    setSendError(null);
    setDraft("");
    setPending({ learner: content, received: "", shown: 0 });
    const result = await streamTutorMessage(sessionId, content, (delta) =>
      setPending((p) => (p ? { ...p, received: p.received + delta } : p)),
    );
    if (!result.ok) {
      setPending(null);
      setDraft(content);
      setSendError(
        tErrors.has(result.code) ? tErrors(result.code) : tErrors("generic"),
      );
      if (result.code === "session_finished") setFinished(true);
      return;
    }
    // Le texte enregistré fait foi ; il finit de s'afficher avant d'entrer dans la conversation.
    setPending((p) => ({
      learner: content,
      received: result.content,
      shown: Math.min(p?.shown ?? 0, result.content.length),
      saved: [
        {
          id: `local-${result.id}`,
          role: "learner",
          content,
          guarded: false,
        },
        {
          id: result.id,
          role: "tutor",
          content: result.content,
          guarded: result.guarded,
        },
      ],
    }));
  }

  async function hint() {
    setSendError(null);
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
    setSendError(null);
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
  const shownError = sendError ?? error;

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3" aria-live="polite">
        {messages.length === 0 && !pending && !finished && (
          <Bubble from="tutor" label={t("tutor")}>
            {t(`intro.${mode}`)}
            <BubbleTools>
              <ListenButton text={t(`intro.${mode}`)} size="xs" />
            </BubbleTools>
          </Bubble>
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
            {m.role === "tutor" && (
              <BubbleTools>
                <ListenButton text={m.content} size="xs" />
              </BubbleTools>
            )}
          </Bubble>
        ))}
        {pending && (
          <>
            <Bubble from="learner" label={t("you")}>
              {pending.learner}
            </Bubble>
            <Bubble from="tutor" label={t("tutor")}>
              {pending.shown > 0 ? (
                pending.received.slice(0, pending.shown)
              ) : (
                <Thinking label={t("sending")} />
              )}
            </Bubble>
          </>
        )}
        <div ref={end} />
      </div>

      {shownError && (
        <p role="alert" className="rounded-lg border bg-muted p-3 text-sm">
          {shownError}
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
          {oral && (
            <p className="text-sm text-muted-foreground">{t("oralHelp")}</p>
          )}
          <Textarea
            value={draft}
            maxLength={2000}
            placeholder={t(oral ? "placeholderOral" : "placeholder")}
            aria-label={t("placeholder")}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="flex flex-wrap items-start gap-2">
            <DictateButton
              prominent={oral}
              disabled={working}
              onStart={() => {
                beforeDictation.current = draft.trim();
              }}
              onText={(spoken) =>
                setDraft(
                  [beforeDictation.current, spoken]
                    .filter((s) => s !== "")
                    .join(" ")
                    .slice(0, 2000),
                )
              }
            />
            <Button
              type="submit"
              variant={oral ? "outline" : "default"}
              size={oral ? "lg" : "default"}
              disabled={working || draft.trim() === ""}
            >
              <PaperPlaneRight />
              {t("send")}
            </Button>
            {mode === "exercise_help" && (
              <Button
                type="button"
                variant="outline"
                disabled={working || hints >= MAX_HINTS}
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
              disabled={working}
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

/** Indicateur d'attente : trois points animés, annoncés aux lecteurs d'écran. */
function Thinking({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted-foreground">
      <span className="sr-only">{label}</span>
      <span aria-hidden className="inline-flex gap-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-current"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      <span aria-hidden className="text-sm">
        {label}
      </span>
    </span>
  );
}

function BubbleTools({ children }: { children: ReactNode }) {
  return <span className="-mb-1 -ml-2 mt-1 flex">{children}</span>;
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
