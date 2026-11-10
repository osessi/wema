"use client";

import {
  ArrowRight,
  FlagCheckered,
  Lightbulb,
  StopCircle,
} from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/brand";
import { Button } from "@wema/ui/components/ui/button";
import {
  ChatBubble,
  ChatComposer,
  ChatThread,
  TypingIndicator,
} from "@wema/ui/components/wema/chat";
import { ProgressRing } from "@wema/ui/components/wema/progress-ring";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { TutorMode } from "../../lib/learner-types";
import { read } from "../../lib/mutate";
import { encourage } from "./encouragement";
import { TutorAvatar } from "./tutor-avatar";
import { type PersonaValue, TutorPersonaPicker } from "./tutor-persona-picker";
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
  /** Heure d'envoi (ISO), absente pour un message tout juste reçu. */
  createdAt?: string | undefined;
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

/** Choix du prof IA remis à plus tard (ce navigateur) : on ne le redemande pas. */
const PERSONA_LATER = "wema.persona.later";
function personaLater(): boolean {
  try {
    return window.localStorage.getItem(PERSONA_LATER) === "1";
  } catch {
    return false;
  }
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
  persona: initialPersona = null,
}: {
  sessionId: string;
  mode: TutorMode;
  open: boolean;
  hintLevel: number;
  variantId: string | null;
  initialMessages: ChatMessage[];
  /** Prénom et avatar choisis par l'élève (null : pas encore choisis). */
  persona?: PersonaValue | null;
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
  const beforeDictation = useRef("");
  const oral = mode === "oral_check";
  const [persona, setPersona] = useState(initialPersona);
  // Première séance sans prof IA choisi : on propose de le choisir (une fois).
  const [askPersona, setAskPersona] = useState(false);
  useEffect(() => {
    if (!initialPersona && open && !personaLater()) setAskPersona(true);
  }, [initialPersona, open]);
  const tutorLabel = persona ? (
    <span className="inline-flex items-center gap-1.5 normal-case">
      <TutorAvatar avatar={persona.avatar} name={persona.name} size={20} />
      {persona.name}
    </span>
  ) : (
    t("tutor")
  );

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
    encourage("step");
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
  const hintsLeft = Math.max(0, MAX_HINTS - hints);

  // Messages consécutifs du même auteur : un seul nom au-dessus du groupe.
  const authorOf = (
    role: ChatMessage["role"],
    previous?: ChatMessage["role"],
  ) =>
    role === previous ? undefined : role === "learner" ? t("you") : tutorLabel;
  const last = messages.at(-1)?.role;

  return (
    <div className="flex flex-col gap-4">
      {askPersona && (
        <section
          aria-labelledby="persona-title"
          className="space-y-4 rounded-card border border-brand/30 bg-brand-soft/40 p-4 sm:p-5"
        >
          <div className="space-y-1">
            <h2 id="persona-title" className="font-semibold">
              {t("persona.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("persona.description")}
            </p>
          </div>
          <TutorPersonaPicker
            initial={null}
            onSaved={(p) => {
              setPersona(p);
              setAskPersona(false);
            }}
            actions={
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  try {
                    window.localStorage.setItem(PERSONA_LATER, "1");
                  } catch {}
                  setAskPersona(false);
                }}
              >
                {t("persona.later")}
              </Button>
            }
          />
        </section>
      )}
      <ChatThread
        label={t("thread")}
        scrollLabel={t("scrollDown")}
        className="max-h-[min(66vh,680px)] rounded-card border bg-surface-subtle/60 p-3 sm:p-4"
      >
        {messages.length === 0 && !pending && !finished && (
          <ChatBubble
            sender="ai"
            author={tutorLabel}
            tools={<ListenButton text={t(`intro.${mode}`)} size="xs" />}
          >
            {t(`intro.${mode}`)}
          </ChatBubble>
        )}
        {messages.map((m, i) => (
          <ChatBubble
            key={m.id}
            sender={m.role === "learner" ? "self" : "ai"}
            author={authorOf(m.role, messages[i - 1]?.role)}
            time={m.createdAt}
            className={cn(
              m.role === messages[i - 1]?.role && "-mt-2",
              "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
            )}
            note={m.guarded ? t("guarded") : undefined}
            tools={
              m.role === "tutor" ? (
                <ListenButton text={m.content} size="xs" />
              ) : undefined
            }
          >
            {m.content}
          </ChatBubble>
        ))}
        {pending && (
          <>
            <ChatBubble sender="self" author={authorOf("learner", last)}>
              {pending.learner}
            </ChatBubble>
            <ChatBubble sender="ai" author={tutorLabel}>
              {pending.shown > 0 ? (
                pending.received.slice(0, pending.shown)
              ) : (
                <TypingIndicator
                  label={
                    persona
                      ? t("sendingNamed", { name: persona.name })
                      : t("sending")
                  }
                />
              )}
            </ChatBubble>
          </>
        )}
      </ChatThread>

      {finished ? (
        <section className="space-y-4 rounded-card border bg-card p-4 shadow-xs sm:p-5">
          <div className="flex items-center gap-3">
            <GlowTile tone="mint" size={40}>
              <FlagCheckered weight="fill" />
            </GlowTile>
            <div className="min-w-0 flex-1">
              <h2 className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                {t("summary")}
              </h2>
              <p className="font-medium">{t("finished")}</p>
            </div>
          </div>
          {outcome?.assessment && (
            <div className="flex flex-wrap gap-6">
              <ProgressRing
                value={percent(outcome.assessment.understanding)}
                label={t("understanding")}
                tone="mint"
                size={64}
              />
              <ProgressRing
                value={percent(outcome.assessment.confidence)}
                label={t("confidence")}
                size={64}
              />
              <p className="sr-only">
                {t("assessment", {
                  understanding: percent(outcome.assessment.understanding),
                  confidence: percent(outcome.assessment.confidence),
                })}
              </p>
            </div>
          )}
          {outcome?.hypotheses !== null &&
            outcome?.hypotheses !== undefined && (
              <p>{t("intakeDone", { count: outcome.hypotheses })}</p>
            )}
          <div className="flex flex-wrap items-center gap-2">
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
            <Button asChild size="sm" className="sm:ml-auto">
              <Link href="/eleve">
                {t("nextStep")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      ) : (
        <div className="space-y-2">
          {oral && (
            <p className="text-sm text-muted-foreground">{t("oralHelp")}</p>
          )}
          <ChatComposer
            value={draft}
            onValueChange={setDraft}
            onSend={() => void send()}
            pending={working}
            maxLength={2000}
            error={shownError}
            labels={{
              input: t("placeholder"),
              placeholder: t(oral ? "placeholderOral" : "placeholder"),
              send: t("send"),
              sending: t("send"),
            }}
            startActions={
              <>
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
                {mode === "exercise_help" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={working || hints >= MAX_HINTS}
                    onClick={hint}
                    aria-label={`${t("hint")} (${t("hintsLeft", { count: hintsLeft })})`}
                  >
                    <Lightbulb
                      aria-hidden
                      weight="fill"
                      className="text-brand"
                    />
                    <span className="hidden sm:inline">{t("hint")}</span>
                    <span
                      aria-hidden
                      className="inline-flex items-center gap-0.5"
                    >
                      {Array.from({ length: MAX_HINTS }, (_, i) => (
                        <span
                          // biome-ignore lint/suspicious/noArrayIndexKey: ampoules fixes
                          key={i}
                          className={cn(
                            "size-1.5 rounded-full",
                            i < hintsLeft
                              ? "bg-brand"
                              : "bg-muted-foreground/30",
                          )}
                        />
                      ))}
                    </span>
                  </Button>
                )}
              </>
            }
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={working}
              onClick={finish}
              className="text-muted-foreground"
            >
              <StopCircle aria-hidden />
              {t("finish")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
