"use client";

import {
  ArrowDown,
  Microphone,
  MicrophoneSlash,
  Paperclip,
  PaperPlaneRight,
  Sparkle,
  SpeakerHigh,
  SpeakerSlash,
  X,
} from "@phosphor-icons/react";
import {
  type ComponentProps,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

/* -------------------------------------------------------------------------- */
/* Horodatage                                                                 */
/* -------------------------------------------------------------------------- */

const sameDay = (a: Date, b: Date, timeZone: string | undefined) => {
  const f = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return f.format(a) === f.format(b);
};

/** Heure seule aujourd'hui, date et heure sinon, en `fr-FR`. */
export function formatChatTime(
  at: Date,
  timeZone?: string | undefined,
  now: Date = new Date(),
): string {
  return new Intl.DateTimeFormat(
    "fr-FR",
    sameDay(at, now, timeZone)
      ? { timeZone, hour: "2-digit", minute: "2-digit" }
      : {
          timeZone,
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        },
  ).format(at);
}

/* -------------------------------------------------------------------------- */
/* Fil                                                                        */
/* -------------------------------------------------------------------------- */

export interface ChatThreadProps extends Omit<ComponentProps<"div">, "role"> {
  /** Nom accessible du fil (« Conversation avec le prof IA »). */
  label: string;
  /** Les `ChatBubble` (et un `ChatBubble` d'attente avec `TypingIndicator`). */
  children: ReactNode;
  /** Contenu avant la liste (état vide, chargement). */
  before?: ReactNode | undefined;
  /** Libellé du bouton qui ramène au dernier message. */
  scrollLabel?: string | undefined;
}

/**
 * Fil de discussion collé en bas (comme `@prompt-kit/chat-container`, sans
 * dépendance) : il suit l'arrivée du texte tant que la personne est en bas,
 * et propose de revenir au dernier message si elle est remontée. Zone
 * `log` annoncée poliment. Donner une hauteur (`className="h-[60vh]"`) pour
 * qu'il défile dans son cadre ; sans hauteur, c'est la page qui défile.
 */
export function ChatThread({
  label,
  children,
  before,
  scrollLabel = "Revenir au dernier message",
  className,
  ...props
}: ChatThreadProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [away, setAway] = useState(false);

  const scrollable = () => {
    const el = scroller.current;
    return el !== null && el.scrollHeight > el.clientHeight + 1;
  };

  const toBottom = useCallback((smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    const behavior: ScrollBehavior =
      smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "smooth"
        : "auto";
    if (el.scrollHeight > el.clientHeight + 1)
      el.scrollTo({ top: el.scrollHeight, behavior });
    else end.current?.scrollIntoView({ block: "nearest", behavior });
  }, []);

  useEffect(() => {
    const target = list.current;
    if (!target) return;
    toBottom(false);
    const observer = new ResizeObserver(() => {
      if (atBottom.current) toBottom(false);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [toBottom]);

  return (
    <div className={cn("relative flex min-h-0 flex-col", className)}>
      <div
        ref={scroller}
        role="log"
        aria-label={label}
        aria-live="polite"
        aria-relevant="additions text"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: zone défilante atteignable au clavier
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget;
          const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          atBottom.current = bottom;
          setAway(!bottom && scrollable());
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-menu outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        {...props}
      >
        {before}
        <ol ref={list} className="flex flex-col gap-4 p-1">
          {children}
        </ol>
        <div ref={end} />
      </div>
      {away ? (
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={scrollLabel}
          title={scrollLabel}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-md"
          onClick={() => {
            atBottom.current = true;
            setAway(false);
            toBottom(true);
          }}
        >
          <ArrowDown aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bulle                                                                      */
/* -------------------------------------------------------------------------- */

/** `self` : la personne connectée ; `ai` : le prof IA ; `human` : un adulte, un camarade. */
export type ChatSender = "self" | "ai" | "human";

export interface ChatBubbleProps
  extends Omit<ComponentProps<"li">, "children"> {
  sender: ChatSender;
  /** Nom affiché au-dessus de la bulle (« Prof IA », « Mme Prof »). */
  author?: ReactNode | undefined;
  /** Corps du message, rendu dans un `<p>` (lu par les tests e2e). */
  children: ReactNode;
  /** Horodatage du message. */
  time?: Date | string | undefined;
  /** Fuseau d'affichage de l'heure (par défaut, celui du navigateur). */
  timeZone?: string | undefined;
  /** Mention sous le texte, dans la bulle (réponse reformulée…). */
  note?: ReactNode | undefined;
  /** Outils libres sous la bulle (le `ListenButton` de l'application…). */
  tools?: ReactNode | undefined;
  /** Bouton « Écouter » intégré : affiché si fourni. */
  onListen?: (() => void) | undefined;
  /** Lecture en cours : le bouton devient « Arrêter ». */
  listening?: boolean | undefined;
  listenLabel?: string | undefined;
  stopLabel?: string | undefined;
}

/**
 * Bulle de message, commune au prof IA et à la messagerie. Rayon de 10 px,
 * la queue du côté de l'auteur. Remplace `Bubble` (`learner/tutor-chat.tsx`)
 * et les `<li>` de `messages/thread-view.tsx`.
 */
export function ChatBubble({
  sender,
  author,
  children,
  time,
  timeZone,
  note,
  tools,
  onListen,
  listening = false,
  listenLabel = "Écouter",
  stopLabel = "Arrêter la lecture",
  className,
  ...props
}: ChatBubbleProps) {
  const self = sender === "self";
  const at = typeof time === "string" ? new Date(time) : time;
  return (
    <li
      data-slot="chat-bubble"
      data-sender={sender}
      className={cn(
        "flex min-w-0 flex-col gap-1",
        self ? "items-end" : "items-start",
        className,
      )}
      {...props}
    >
      {author ? (
        <span className="flex items-center gap-1 px-1 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          {sender === "ai" ? (
            <Sparkle aria-hidden weight="fill" className="size-3 text-brand" />
          ) : null}
          {author}
        </span>
      ) : null}
      <div
        className={cn(
          "max-w-[85%] min-w-0 rounded-menu px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[75%]",
          self &&
            "rounded-br-xs border border-brand/35 bg-brand-soft text-foreground",
          sender === "ai" &&
            "rounded-bl-xs border bg-card text-card-foreground",
          sender === "human" &&
            "rounded-bl-xs bg-secondary text-secondary-foreground",
        )}
      >
        <p className="break-words whitespace-pre-wrap">{children}</p>
        {note ? (
          <p className={cn("mt-2 text-xs", "text-muted-foreground")}>{note}</p>
        ) : null}
      </div>
      {at || tools || onListen ? (
        <div
          className={cn(
            "flex items-center gap-1 px-1 text-[11px] text-muted-foreground",
            self && "flex-row-reverse",
          )}
        >
          {at ? (
            <time
              dateTime={at.toISOString()}
              className="tabular-nums"
              // L'heure dépend du fuseau et de l'instant : le serveur peut différer.
              suppressHydrationWarning
            >
              {formatChatTime(at, timeZone)}
            </time>
          ) : null}
          {onListen ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-pressed={listening}
              onClick={onListen}
              className="text-muted-foreground"
            >
              {listening ? (
                <SpeakerSlash aria-hidden />
              ) : (
                <SpeakerHigh aria-hidden />
              )}
              {listening ? stopLabel : listenLabel}
            </Button>
          ) : null}
          {tools}
        </div>
      ) : null}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Frappe en cours                                                            */
/* -------------------------------------------------------------------------- */

export interface TypingIndicatorProps extends ComponentProps<"span"> {
  /** Texte annoncé (« Le prof IA réfléchit… »). */
  label: string;
  /** Affiche aussi le texte à côté des points. */
  showLabel?: boolean | undefined;
}

/** Trois points qui ondulent ; immobiles si l'utilisateur réduit les animations. */
export function TypingIndicator({
  label,
  showLabel = true,
  className,
  ...props
}: TypingIndicatorProps) {
  return (
    <span
      data-slot="typing-indicator"
      className={cn(
        "inline-flex items-center gap-2 text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden className="inline-flex items-center gap-1">
        {[0, 160, 320].map((delay) => (
          <span
            key={delay}
            className="size-1.5 rounded-full bg-current motion-safe:animate-bounce"
            style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
          />
        ))}
      </span>
      {showLabel ? (
        <span aria-hidden className="text-sm">
          {label}
        </span>
      ) : null}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Saisie                                                                     */
/* -------------------------------------------------------------------------- */

export interface ChatAttachment {
  id: string;
  name: string;
}

export interface ChatComposerLabels {
  /** Nom accessible de la zone de saisie (et texte d'exemple par défaut). */
  input: string;
  placeholder: string;
  send: string;
  sending: string;
  dictate: string;
  stopDictation: string;
  attach: string;
  /** `{name}` est remplacé par le nom du fichier. */
  removeAttachment: string;
}

const COMPOSER_LABELS: ChatComposerLabels = {
  input: "Votre message",
  placeholder: "Écrivez votre message…",
  send: "Envoyer",
  sending: "Envoi…",
  dictate: "Dicter",
  stopDictation: "Terminer la dictée",
  attach: "Joindre un fichier",
  removeAttachment: "Retirer {name}",
};

export interface ChatComposerProps
  extends Omit<ComponentProps<"form">, "onSubmit" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Envoi : Entrée ou bouton. Maj+Entrée va à la ligne. */
  onSend: (value: string) => void;
  labels?: Partial<ChatComposerLabels> | undefined;
  /** Envoi en cours : le bouton est désactivé et affiche `sending`. */
  pending?: boolean | undefined;
  disabled?: boolean | undefined;
  maxLength?: number | undefined;
  rows?: number | undefined;
  /** Dictée : bouton micro affiché si `onDictateToggle` est fourni. */
  onDictateToggle?: (() => void) | undefined;
  dictating?: boolean | undefined;
  /** Pièce jointe : bouton trombone affiché si `onAttach` est fourni. */
  onAttach?: ((files: File[]) => void) | undefined;
  accept?: string | undefined;
  attachments?: ChatAttachment[] | undefined;
  onRemoveAttachment?: ((id: string) => void) | undefined;
  /** Boutons supplémentaires à gauche (indice, `DictateButton` maison…). */
  startActions?: ReactNode | undefined;
  /** Message d'erreur (rôle `alert`). */
  error?: ReactNode | undefined;
  /** Bouton d'envoi en avant (jaune) ou courant (noir). */
  sendVariant?: "default" | "outline" | undefined;
}

/**
 * Zone de saisie d'une discussion (modèle `@prompt-kit/prompt-input` et
 * `input-group`) : texte, micro pour la dictée, pièce jointe et envoi.
 * Remplace le formulaire de `learner/tutor-chat.tsx` et `messages/composer.tsx`.
 */
export function ChatComposer({
  value,
  onValueChange,
  onSend,
  labels: labelsProp,
  pending = false,
  disabled = false,
  maxLength = 4000,
  rows = 2,
  onDictateToggle,
  dictating = false,
  onAttach,
  accept,
  attachments,
  onRemoveAttachment,
  startActions,
  error,
  sendVariant = "default",
  className,
  ...props
}: ChatComposerProps) {
  const labels = { ...COMPOSER_LABELS, ...labelsProp };
  const fileInput = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const blocked = disabled || pending;
  const canSend = !blocked && value.trim() !== "";

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSend) return;
    onSend(value.trim());
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form
      data-slot="chat-composer"
      onSubmit={submit}
      className={cn("space-y-2", className)}
      {...props}
    >
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="rounded-control border border-input bg-card shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
        {attachments && attachments.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5 px-3 pt-3">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="inline-flex max-w-full items-center gap-1 rounded-chip bg-secondary py-0.5 pr-0.5 pl-2 text-xs"
              >
                <Paperclip aria-hidden className="size-3 shrink-0" />
                <span className="truncate">{a.name}</span>
                {onRemoveAttachment ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={labels.removeAttachment.replace(
                      "{name}",
                      a.name,
                    )}
                    onClick={() => onRemoveAttachment(a.id)}
                  >
                    <X aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <Textarea
          id={inputId}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={labels.placeholder}
          aria-label={labels.input}
          maxLength={maxLength}
          rows={rows}
          disabled={disabled}
          className="min-h-14 resize-none border-0 bg-transparent px-3 pt-3 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
          {onDictateToggle ? (
            <Button
              type="button"
              variant={dictating ? "default" : "ghost"}
              size="sm"
              aria-pressed={dictating}
              disabled={blocked && !dictating}
              onClick={onDictateToggle}
              className={cn(dictating && "motion-safe:animate-pulse")}
            >
              {dictating ? (
                <MicrophoneSlash aria-hidden />
              ) : (
                <Microphone aria-hidden />
              )}
              <span className="sr-only sm:not-sr-only">
                {dictating ? labels.stopDictation : labels.dictate}
              </span>
            </Button>
          ) : null}
          {onAttach ? (
            <>
              <input
                ref={fileInput}
                type="file"
                accept={accept}
                multiple
                tabIndex={-1}
                className="sr-only"
                aria-hidden
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) onAttach(files);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={labels.attach}
                title={labels.attach}
                disabled={blocked}
                onClick={() => fileInput.current?.click()}
              >
                <Paperclip aria-hidden />
              </Button>
            </>
          ) : null}
          {startActions}
          <Button
            type="submit"
            size="sm"
            variant={sendVariant}
            disabled={!canSend}
            aria-busy={pending || undefined}
            className="ml-auto"
          >
            <PaperPlaneRight aria-hidden weight="fill" />
            <span className="sr-only sm:not-sr-only">
              {pending ? labels.sending : labels.send}
            </span>
          </Button>
        </div>
      </div>
    </form>
  );
}
