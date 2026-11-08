"use client";

import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { chamfer } from "../../wa/components/reactbits/TicketStubFooter";
import { TsfArrow } from "../../wa/components/v2/tsf/tsf-cta";
import { cn } from "../../wa/ui/lib/utils";

/** Les profils acceptés par `POST /api/contact`. */
const PROFILES = [
  { value: "parent", label: "Parent" },
  { value: "eleve", label: "Élève" },
  { value: "prof", label: "Prof" },
  { value: "ecole", label: "École ou réseau" },
  { value: "autre", label: "Autre" },
] as const;

type Profile = (typeof PROFILES)[number]["value"];
type FieldName = "name" | "email" | "profile" | "organization" | "message";
type Errors = Partial<Record<FieldName, string>>;

const LIMITS = {
  name: 120,
  email: 254,
  organization: 200,
  messageMin: 10,
  messageMax: 4000,
};
const FIELD_ORDER: readonly FieldName[] = [
  "name",
  "email",
  "profile",
  "organization",
  "message",
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LABEL =
  "font-mono text-[11.5px] font-medium tracking-[0.08em] text-foreground/60 uppercase";
const CONTROL =
  "w-full scroll-mt-32 border border-foreground/15 bg-background px-3.5 text-[16px] text-foreground placeholder:text-foreground/40 transition-colors hover:border-foreground/30 focus-visible:border-brand-active focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand aria-invalid:border-[var(--destructive)] dark:focus-visible:border-brand";
const CUT = chamfer(0, 0, 12, 0);

const isProfile = (value: string): value is Profile =>
  PROFILES.some((profile) => profile.value === value);

const withOrganization = (profile: Profile | "") =>
  profile === "prof" || profile === "ecole";

type Values = {
  name: string;
  email: string;
  profile: Profile | "";
  organization: string;
  message: string;
};

function validate(values: Values): Errors {
  const errors: Errors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const message = values.message.trim();
  if (name === "") errors.name = "Indiquez votre nom.";
  else if (name.length > LIMITS.name)
    errors.name = `${LIMITS.name} caractères au plus.`;
  if (email === "") errors.email = "Indiquez votre adresse e-mail.";
  else if (email.length > LIMITS.email || !EMAIL.test(email))
    errors.email =
      "Cette adresse e-mail n’est pas valide. Exemple : nom@domaine.fr";
  if (values.profile === "")
    errors.profile = "Choisissez ce qui vous décrit le mieux.";
  if (
    withOrganization(values.profile) &&
    values.organization.trim().length > LIMITS.organization
  )
    errors.organization = `${LIMITS.organization} caractères au plus.`;
  if (message.length < LIMITS.messageMin)
    errors.message = `Écrivez au moins ${LIMITS.messageMin} caractères.`;
  else if (message.length > LIMITS.messageMax)
    errors.message = `${LIMITS.messageMax} caractères au plus.`;
  return errors;
}

/** Lit les erreurs de champ éventuellement renvoyées par l'API (forme libre). */
function serverFieldErrors(body: unknown): FieldName[] {
  if (typeof body !== "object" || body === null) return [];
  const candidates = ["fieldErrors", "errors", "issues"];
  for (const key of candidates) {
    const value: unknown = Reflect.get(body, key);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return FIELD_ORDER.filter((field) => field in value);
    }
  }
  return [];
}

const SERVER_MESSAGES: Record<FieldName, string> = {
  name: "Vérifiez votre nom.",
  email: "Vérifiez votre adresse e-mail.",
  profile: "Choisissez ce qui vous décrit le mieux.",
  organization: "Vérifiez le nom de votre structure.",
  message: `Le message doit faire entre ${LIMITS.messageMin} et ${LIMITS.messageMax} caractères.`,
};

function FieldError({
  id,
  message,
}: {
  readonly id: string;
  readonly message: string | undefined;
}) {
  if (message === undefined) return null;
  return (
    <p
      id={id}
      className="flex items-start gap-1.5 text-[14px] text-[var(--destructive-text)]"
    >
      <WarningCircle
        aria-hidden="true"
        weight="fill"
        className="mt-[3px] size-4 shrink-0"
      />
      {message}
    </p>
  );
}

export function ContactForm() {
  const uid = useId();
  const ids = (field: string) => `${uid}-${field}`;
  const [values, setValues] = useState<Values>({
    name: "",
    email: "",
    profile: "",
    organization: "",
    message: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [failure, setFailure] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const done = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (status !== "sent") return;
    done.current?.focus({ preventScroll: true });
    done.current?.scrollIntoView({ block: "center" });
  }, [status]);

  const update = <K extends keyof Values>(key: K, value: Values[K]) => {
    const next = { ...values, [key]: value };
    setValues(next);
    if (submitted) setErrors(validate(next));
  };

  const focusField = (field: FieldName) => {
    const target =
      field === "profile"
        ? form.current?.querySelector<HTMLInputElement>('input[name="profile"]')
        : form.current?.querySelector<HTMLElement>(`[name="${field}"]`);
    target?.focus();
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    setSubmitted(true);
    setFailure(null);
    const found = validate(values);
    setErrors(found);
    const invalid = FIELD_ORDER.filter((field) => found[field] !== undefined);
    const first = invalid[0];
    if (first !== undefined) {
      setAnnounce(
        invalid.length === 1
          ? "Un champ est à corriger."
          : `${invalid.length} champs sont à corriger.`,
      );
      focusField(first);
      return;
    }
    if (values.profile === "") return;

    setStatus("sending");
    setAnnounce("Envoi du message…");
    const organization = values.organization.trim();
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          profile: values.profile,
          ...(withOrganization(values.profile) && organization !== ""
            ? { organization }
            : {}),
          message: values.message.trim(),
          website: honeypot.current?.value ?? "",
        }),
      });
      if (response.status === 201 || response.ok) {
        setStatus("sent");
        setAnnounce("Message envoyé.");
        return;
      }
      setStatus("idle");
      if (response.status === 429) {
        const text =
          "Plusieurs messages viennent d’être envoyés depuis cette connexion. Réessayez dans quelques minutes.";
        setFailure(text);
        setAnnounce(text);
        return;
      }
      if (response.status === 400) {
        const body: unknown = await response.json().catch(() => null);
        const fields = serverFieldErrors(body);
        if (fields.length > 0) {
          const next: Errors = {};
          for (const field of fields) next[field] = SERVER_MESSAGES[field];
          setErrors(next);
          const firstField = fields[0];
          if (firstField !== undefined) focusField(firstField);
        }
        const text =
          "Le message n’a pas été accepté. Vérifiez les champs signalés, puis renvoyez-le.";
        setFailure(text);
        setAnnounce(text);
        return;
      }
      const text =
        "Le message n’est pas parti : le service ne répond pas. Réessayez dans un instant.";
      setFailure(text);
      setAnnounce(text);
    } catch {
      setStatus("idle");
      const text =
        "Le message n’est pas parti. Vérifiez votre connexion à Internet, puis réessayez.";
      setFailure(text);
      setAnnounce(text);
    }
  }

  if (status === "sent") {
    return (
      <div className="grid gap-3 py-2">
        <CheckCircle
          weight="fill"
          className="size-9 text-brand-active dark:text-brand"
          aria-hidden="true"
        />
        <h3
          ref={done}
          tabIndex={-1}
          className="text-[22px] leading-tight font-semibold tracking-[-0.015em] text-foreground outline-none"
        >
          Message bien reçu.
        </h3>
        <p className="text-pretty text-[16px] leading-relaxed text-foreground/75">
          Une personne de l’équipe le lit et vous répond à{" "}
          <span className="font-medium text-foreground">
            {values.email.trim()}
          </span>
          . Pensez à regarder vos courriers indésirables si rien n’arrive.
        </p>
        <p role="status" className="sr-only">
          {announce}
        </p>
      </div>
    );
  }

  const describe = (field: FieldName, extra?: string) =>
    [extra, errors[field] === undefined ? undefined : ids(`${field}-error`)]
      .filter((value) => value !== undefined)
      .join(" ") || undefined;

  const messageLength = values.message.trim().length;
  const showOrganization = withOrganization(values.profile);
  const sending = status === "sending";

  return (
    <form
      ref={form}
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      aria-describedby={ids("privacy")}
      className="relative grid gap-6"
    >
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          <label htmlFor={ids("name")} className={LABEL}>
            Nom
          </label>
          <input
            id={ids("name")}
            name="name"
            type="text"
            autoComplete="name"
            maxLength={LIMITS.name}
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            aria-invalid={errors.name !== undefined}
            aria-describedby={describe("name")}
            className={cn(CONTROL, "h-12")}
          />
          <FieldError id={ids("name-error")} message={errors.name} />
        </div>
        <div className="grid content-start gap-2">
          <label htmlFor={ids("email")} className={LABEL}>
            E-mail
          </label>
          <input
            id={ids("email")}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            maxLength={LIMITS.email}
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            aria-invalid={errors.email !== undefined}
            aria-describedby={describe("email")}
            className={cn(CONTROL, "h-12")}
          />
          <FieldError id={ids("email-error")} message={errors.email} />
        </div>
      </div>

      <fieldset
        aria-invalid={errors.profile !== undefined}
        aria-describedby={describe("profile")}
        className="grid gap-3"
      >
        <legend className={cn(LABEL, "mb-3")}>Vous êtes</legend>
        <div className="flex flex-wrap gap-2">
          {PROFILES.map((profile) => (
            <label
              key={profile.value}
              className={cn(
                "relative inline-flex min-h-11 cursor-pointer items-center border px-4 text-[15px] font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand",
                values.profile === profile.value
                  ? "border-brand bg-brand text-[var(--on-brand)]"
                  : "border-foreground/15 bg-background text-foreground/85 hover:border-foreground/40",
              )}
            >
              <input
                type="radio"
                name="profile"
                value={profile.value}
                checked={values.profile === profile.value}
                onChange={(event) => {
                  if (isProfile(event.target.value))
                    update("profile", event.target.value);
                }}
                className="sr-only"
              />
              {profile.label}
            </label>
          ))}
        </div>
        <FieldError id={ids("profile-error")} message={errors.profile} />
      </fieldset>

      {showOrganization ? (
        <div className="grid content-start gap-2">
          <label htmlFor={ids("organization")} className={LABEL}>
            {values.profile === "ecole"
              ? "École ou réseau"
              : "Établissement ou structure"}{" "}
            <span className="font-sans font-normal tracking-normal text-foreground/50 normal-case">
              (facultatif)
            </span>
          </label>
          <input
            id={ids("organization")}
            name="organization"
            type="text"
            autoComplete="organization"
            maxLength={LIMITS.organization}
            value={values.organization}
            onChange={(event) => update("organization", event.target.value)}
            aria-invalid={errors.organization !== undefined}
            aria-describedby={describe("organization")}
            className={cn(CONTROL, "h-12")}
          />
          <FieldError
            id={ids("organization-error")}
            message={errors.organization}
          />
        </div>
      ) : null}

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor={ids("message")} className={LABEL}>
            Votre message
          </label>
          <span
            id={ids("message-count")}
            className="font-mono text-[11.5px] text-foreground/50 tabular-nums"
          >
            {messageLength} / {LIMITS.messageMax}
          </span>
        </div>
        <textarea
          id={ids("message")}
          name="message"
          rows={6}
          maxLength={LIMITS.messageMax}
          value={values.message}
          onChange={(event) => update("message", event.target.value)}
          aria-invalid={errors.message !== undefined}
          aria-describedby={describe("message", ids("message-hint"))}
          placeholder="Votre question, la classe et la matière concernées, ce que vous attendez de Wema…"
          className={cn(CONTROL, "min-h-40 resize-y py-3 leading-relaxed")}
        />
        <p
          id={ids("message-hint")}
          className="text-[13.5px] text-foreground/55"
        >
          Entre {LIMITS.messageMin} et {LIMITS.messageMax} caractères.
        </p>
        <FieldError id={ids("message-error")} message={errors.message} />
      </div>

      {/* Champ piège : invisible pour les personnes, rempli par les robots. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label>
          Site web
          <input
            ref={honeypot}
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
      </div>

      {failure === null ? null : (
        <div
          role="alert"
          className="flex items-start gap-3 border border-[var(--destructive)]/40 bg-[var(--destructive-soft)] px-4 py-3 text-[15px] leading-relaxed text-[var(--destructive-text)]"
        >
          <WarningCircle
            aria-hidden="true"
            weight="fill"
            className="mt-[3px] size-5 shrink-0"
          />
          {failure}
        </div>
      )}

      <button
        type="submit"
        className="tk-cta w-full disabled:cursor-progress disabled:opacity-70"
        data-tone="accent"
        style={{ clipPath: CUT }}
        disabled={sending}
        aria-busy={sending}
      >
        <span>{sending ? "Envoi en cours…" : "Envoyer le message"}</span>
        <TsfArrow />
      </button>
      <p
        id={ids("privacy")}
        className="text-[13px] leading-relaxed text-foreground/55"
      >
        Votre nom, votre e-mail et votre message servent uniquement à vous
        répondre. Détails dans notre{" "}
        <a
          href="/app/confidentialite"
          className="underline underline-offset-2 hover:text-foreground"
        >
          politique de confidentialité
        </a>
        .
      </p>
    </form>
  );
}
