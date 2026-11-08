'use client';

import {
  Buildings,
  ChalkboardTeacher,
  CheckCircle,
  DotsThreeOutline,
  type Icon,
  Student,
  UsersThree,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import Link from 'next/link';
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { cn } from '../../ui/lib/utils';
import SlantMorphButton from '../tweenui/slant-morph-button';

/**
 * La fenêtre de contact, reprise du site Winner Agency. Elle s'ouvre sur tout
 * lien vers /contact ou #contact du site (la page /contact reste accessible
 * directement, et sans JavaScript). Envoi : POST /api/contact.
 */

const HASH = '#contact';
const OPEN_EVENT = 'wema:contact-open';

export function openContactDialog() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type Profile = 'parent' | 'eleve' | 'prof' | 'ecole' | 'autre';

const PROFILES: readonly { value: Profile; label: string; icon: Icon; color: string; ink: string }[] =
  [
    { value: 'parent', label: 'Parent', icon: UsersThree, color: '#FFC529', ink: '#1A1403' },
    { value: 'eleve', label: 'Élève', icon: Student, color: '#5B7CFF', ink: '#FFFFFF' },
    { value: 'prof', label: 'Prof', icon: ChalkboardTeacher, color: '#2F9A60', ink: '#FFFFFF' },
    { value: 'ecole', label: 'École ou réseau', icon: Buildings, color: '#E46BFF', ink: '#1A1403' },
    { value: 'autre', label: 'Autre', icon: DotsThreeOutline, color: '#8A8D82', ink: '#FFFFFF' },
  ];

const LIMITS = { name: 120, email: 254, organization: 200, message: 4000 } as const;

type Field = 'name' | 'email' | 'profile' | 'organization' | 'message';

interface Values {
  name: string;
  email: string;
  profile: Profile | '';
  organization: string;
  message: string;
}

const EMPTY: Values = { name: '', email: '', profile: '', organization: '', message: '' };

type Errors = Partial<Record<Field, string>>;

const line = (v: string) => v.replace(/\s+/g, ' ').trim();

function check(values: Values): Errors {
  const errors: Errors = {};
  const name = line(values.name);
  if (name === '') errors.name = 'Indiquez votre nom.';
  else if (name.length > LIMITS.name) errors.name = `${LIMITS.name} caractères au plus.`;
  const email = line(values.email);
  if (email === '') errors.email = 'Indiquez votre adresse e-mail.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = 'Cette adresse e-mail n’est pas valide.';
  if (values.profile === '') errors.profile = 'Dites-nous qui vous êtes.';
  if (line(values.organization).length > LIMITS.organization)
    errors.organization = `${LIMITS.organization} caractères au plus.`;
  const message = values.message.trim();
  if (message.length < 10) errors.message = 'Écrivez au moins 10 caractères.';
  else if (message.length > LIMITS.message) errors.message = `${LIMITS.message} caractères au plus.`;
  return errors;
}

/** Les codes de validation de l'API, traduits champ par champ. */
function fromApi(details: unknown): Errors {
  const errors: Errors = {};
  if (!Array.isArray(details)) return errors;
  for (const d of details) {
    if (typeof d !== 'object' || d === null) continue;
    const field = 'field' in d ? d.field : undefined;
    if (field === 'name') errors.name = 'Vérifiez votre nom.';
    if (field === 'email') errors.email = 'Cette adresse e-mail n’est pas valide.';
    if (field === 'profile') errors.profile = 'Dites-nous qui vous êtes.';
    if (field === 'organization') errors.organization = 'Vérifiez ce champ.';
    if (field === 'message') errors.message = 'Le message doit faire entre 10 et 4000 caractères.';
  }
  return errors;
}

function Cell({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error: string | undefined;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'group/cell relative flex min-w-0 flex-col gap-1.5 border-b border-[var(--tk-line)] px-4 pt-3 pb-3 transition-colors focus-within:bg-brand/[0.05] sm:px-5',
        error !== undefined && 'bg-destructive/[0.04]',
        className,
      )}
    >
      <label
        htmlFor={id}
        className="flex items-baseline justify-between gap-2 font-mono text-[10.5px] font-medium tracking-[0.14em] text-foreground/55 uppercase transition-colors group-focus-within/cell:text-brand-active dark:group-focus-within/cell:text-brand"
      >
        {label}
        {hint === undefined ? null : (
          <span className="tracking-[0.08em] text-foreground/40 normal-case">{hint}</span>
        )}
      </label>
      {children}
      {error === undefined ? null : (
        <p id={`${id}-error`} className="text-[12.5px] leading-snug text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const FIELD =
  'w-full min-w-0 bg-transparent text-[16px] text-foreground outline-none placeholder:text-foreground/35 sm:text-[15.5px]';

function frameVars(vars: Record<string, string>): CSSProperties {
  return vars;
}

export function ContactDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const doneButton = useRef<HTMLButtonElement>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);
  const uid = useId();
  const ids: Record<Field, string> = {
    name: `${uid}-name`,
    email: `${uid}-email`,
    profile: `${uid}-profile`,
    organization: `${uid}-org`,
    message: `${uid}-message`,
  };
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const open = useCallback(() => {
    const el = dialog.current;
    if (el === null || el.open) return;
    opener.current = document.activeElement;
    el.showModal();
    document.documentElement.style.overflow = 'hidden';
    window.requestAnimationFrame(() => firstField.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === HASH) open();
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Sur la page /contact elle-même, le formulaire est déjà là.
      if (window.location.pathname === '/contact') return;
      if (url.hash !== HASH && url.pathname !== '/contact') return;
      event.preventDefault();
      open();
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    window.addEventListener(OPEN_EVENT, open);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener(OPEN_EVENT, open);
      document.removeEventListener('click', onClick, true);
    };
  }, [open]);

  useEffect(() => {
    if (sentTo !== null) doneButton.current?.focus();
  }, [sentTo]);

  function onClose() {
    document.documentElement.style.overflow = '';
    if (window.location.hash === HASH) {
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      );
    }
    if (sentTo !== null) {
      setValues(EMPTY);
      setErrors({});
      setTried(false);
      setSentTo(null);
    }
    setNotice(null);
    const back = opener.current;
    opener.current = null;
    if (back instanceof HTMLElement && back.isConnected) back.focus({ preventScroll: true });
  }

  function set<K extends keyof Values>(field: K, value: Values[K]) {
    const next = { ...values, [field]: value };
    setValues(next);
    if (tried) setErrors(check(next));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    setNotice(null);
    setTried(true);
    const found = check(values);
    setErrors(found);
    const order: Field[] = ['name', 'email', 'profile', 'organization', 'message'];
    const first = order.find((f) => found[f] !== undefined);
    if (first !== undefined) {
      const target =
        first === 'profile'
          ? dialog.current?.querySelector<HTMLInputElement>(`input[name="${ids.profile}"]`)
          : document.getElementById(ids[first]);
      target?.focus();
      return;
    }
    setSending(true);
    try {
      const organization = line(values.organization);
      const response = await fetch('/api/contact', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: line(values.name),
          email: line(values.email),
          profile: values.profile,
          ...(organization === '' ? {} : { organization }),
          message: values.message.trim(),
          website: honeypot.current?.value ?? '',
        }),
      });
      if (response.ok) {
        setSentTo(line(values.name).split(' ')[0] ?? '');
        return;
      }
      if (response.status === 429) {
        setNotice('Trop d’envois depuis cette connexion. Réessayez dans une heure.');
        return;
      }
      if (response.status === 400) {
        const body: unknown = await response.json().catch(() => null);
        const error =
          typeof body === 'object' && body !== null && 'error' in body ? body.error : undefined;
        const details =
          typeof error === 'object' && error !== null && 'details' in error
            ? error.details
            : undefined;
        const apiErrors = fromApi(details);
        setErrors(apiErrors);
        setNotice('Certains champs sont à corriger.');
        return;
      }
      setNotice('Le message n’est pas parti. Réessayez dans quelques minutes.');
    } catch {
      setNotice('Pas de connexion au serveur. Vérifiez votre réseau, puis réessayez.');
    } finally {
      setSending(false);
    }
  }

  const describedBy = (field: Field, extra?: string) =>
    [errors[field] === undefined ? null : `${ids[field]}-error`, extra ?? null]
      .filter((id) => id !== null)
      .join(' ') || undefined;

  const count = values.message.length;
  const showOrg = values.profile === 'prof' || values.profile === 'ecole';

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: le clic sur le fond équivaut à Échap, déjà géré par le dialogue natif.
    <dialog
      ref={dialog}
      aria-labelledby={`${uid}-title`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className="plan-dialog contact-dialog m-0 h-dvh w-screen sm:m-auto sm:h-fit sm:w-[min(760px,calc(100vw-48px))]"
    >
      <div
        className="tk-frame h-full sm:h-auto"
        style={frameVars({ '--tk-edge': 'color-mix(in srgb, var(--foreground) 14%, transparent)' })}
      >
        <div className="tk-frame-cut paper flex h-full flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain sm:max-h-[calc(100dvh-48px)]">
            <div className="px-4 pt-5 pb-8 sm:px-10 sm:pt-9 sm:pb-10">
              <header className="relative pb-6 sm:pb-7">
                <div className="min-w-0 pr-12 text-left">
                  <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-brand-active uppercase dark:text-brand">
                    Écrire à l’équipe
                  </p>
                  <h2
                    id={`${uid}-title`}
                    className="mt-2 text-[28px] leading-[1.05] font-light tracking-[-0.035em] text-foreground sm:text-[40px]"
                  >
                    {sentTo === null
                      ? 'Une question ? Parlons-en.'
                      : `Merci${sentTo === '' ? '' : `, ${sentTo}`}. C’est bien reçu.`}
                  </h2>
                  {sentTo === null ? (
                    <p className="mt-2.5 max-w-[520px] text-[14.5px] leading-relaxed text-foreground/65 sm:text-[15.5px]">
                      Parent, élève, prof ou école : dites-nous où vous en êtes. Une personne de
                      l’équipe lit votre message et vous répond par e-mail.
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dialog.current?.close()}
                  aria-label="Fermer"
                  className="absolute top-0 right-0 grid size-10 place-items-center border border-[var(--tk-edge)] text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <X className="size-4" />
                </button>
              </header>

              {sentTo !== null ? (
                <div role="status" className="grid justify-items-start gap-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle
                      weight="fill"
                      className="mt-0.5 size-6 shrink-0 text-brand"
                      aria-hidden="true"
                    />
                    <p className="text-[16px] leading-relaxed text-foreground/80">
                      Votre message est arrivé. Une personne de l’équipe vous répond à l’adresse
                      indiquée.
                    </p>
                  </div>
                  <button
                    ref={doneButton}
                    type="button"
                    onClick={() => dialog.current?.close()}
                    className="inline-flex h-11 items-center border border-[var(--tk-edge)] px-5 text-[14px] font-medium text-foreground transition-colors hover:border-foreground/40"
                  >
                    Fermer
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} noValidate>
                  <div className="group/box tk-frame w-full">
                    <div className="tk-frame-cut bg-brand/30 p-[5px] backdrop-blur-xl transition-colors duration-300 group-focus-within/box:bg-brand/45 group-hover/box:bg-[#ffc529]">
                      <div className="tk-frame" style={frameVars({ '--c': '12px' })}>
                        <div className="tk-frame-cut bg-surface/95 text-left">
                          <div className="grid grid-cols-2">
                            <Cell
                              id={ids.name}
                              label="Nom"
                              error={errors.name}
                              className="col-span-2 sm:col-span-1 sm:border-r"
                            >
                              <input
                                ref={firstField}
                                id={ids.name}
                                value={values.name}
                                onChange={(e) => set('name', e.target.value)}
                                autoComplete="name"
                                maxLength={LIMITS.name}
                                placeholder="Votre nom"
                                aria-invalid={errors.name !== undefined}
                                aria-describedby={describedBy('name')}
                                className={FIELD}
                              />
                            </Cell>
                            <Cell
                              id={ids.email}
                              label="E-mail"
                              error={errors.email}
                              className="col-span-2 sm:col-span-1"
                            >
                              <input
                                id={ids.email}
                                type="email"
                                inputMode="email"
                                value={values.email}
                                onChange={(e) => set('email', e.target.value)}
                                autoComplete="email"
                                spellCheck={false}
                                maxLength={LIMITS.email}
                                placeholder="vous@exemple.fr"
                                aria-invalid={errors.email !== undefined}
                                aria-describedby={describedBy('email')}
                                className={FIELD}
                              />
                            </Cell>
                          </div>

                          <fieldset
                            aria-describedby={describedBy('profile')}
                            className={cn(
                              'group/cell border-b border-[var(--tk-line)] px-4 pt-3 pb-3.5 sm:px-5',
                              errors.profile !== undefined && 'bg-destructive/[0.04]',
                            )}
                          >
                            <legend className="float-left mb-2.5 w-full font-mono text-[10.5px] font-medium tracking-[0.14em] text-foreground/55 uppercase transition-colors group-focus-within/cell:text-brand-active dark:group-focus-within/cell:text-brand">
                              Vous êtes
                            </legend>
                            <div className="clear-both flex flex-wrap gap-2">
                              {PROFILES.map((p) => {
                                const Glyph = p.icon;
                                const chosen = values.profile === p.value;
                                return (
                                  <label
                                    key={p.value}
                                    className="contact-reason relative inline-flex h-9 cursor-pointer items-center gap-2 border px-3 text-[13.5px] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
                                    style={frameVars({ '--reason': p.color, '--reason-ink': p.ink })}
                                    data-chosen={chosen || undefined}
                                  >
                                    <input
                                      type="radio"
                                      name={ids.profile}
                                      value={p.value}
                                      checked={chosen}
                                      onChange={() => set('profile', p.value)}
                                      className="sr-only"
                                    />
                                    <Glyph
                                      weight={chosen ? 'fill' : 'duotone'}
                                      className="contact-reason-icon size-4 shrink-0"
                                      aria-hidden="true"
                                    />
                                    {p.label}
                                  </label>
                                );
                              })}
                            </div>
                            {errors.profile === undefined ? null : (
                              <p
                                id={`${ids.profile}-error`}
                                className="mt-2 text-[12.5px] text-destructive"
                              >
                                {errors.profile}
                              </p>
                            )}
                          </fieldset>

                          {showOrg ? (
                            <Cell
                              id={ids.organization}
                              label="Établissement ou structure"
                              hint="facultatif"
                              error={errors.organization}
                            >
                              <input
                                id={ids.organization}
                                value={values.organization}
                                onChange={(e) => set('organization', e.target.value)}
                                autoComplete="organization"
                                maxLength={LIMITS.organization}
                                placeholder="Collège, cours particuliers, réseau…"
                                aria-invalid={errors.organization !== undefined}
                                aria-describedby={describedBy('organization')}
                                className={FIELD}
                              />
                            </Cell>
                          ) : null}

                          <Cell
                            id={ids.message}
                            label="Votre message"
                            error={errors.message}
                            className="border-b-0"
                          >
                            <textarea
                              id={ids.message}
                              value={values.message}
                              onChange={(e) => set('message', e.target.value)}
                              rows={4}
                              maxLength={LIMITS.message}
                              placeholder="La classe, la matière, ce que vous cherchez…"
                              aria-invalid={errors.message !== undefined}
                              aria-describedby={describedBy('message', `${ids.message}-count`)}
                              className={cn(FIELD, 'min-h-[104px] resize-none leading-relaxed')}
                            />
                            <p
                              id={`${ids.message}-count`}
                              className={cn(
                                'self-end font-mono text-[11px] tabular-nums',
                                count >= LIMITS.message ? 'text-destructive' : 'text-foreground/45',
                              )}
                            >
                              {count} / {LIMITS.message}
                            </p>
                          </Cell>
                        </div>
                      </div>
                    </div>
                  </div>

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
                      />
                    </label>
                  </div>

                  {notice === null ? null : (
                    <p
                      role="alert"
                      className="mt-4 flex items-start gap-2 border border-destructive/30 bg-destructive/[0.06] px-3.5 py-2.5 text-[13.5px] leading-snug text-destructive"
                    >
                      <WarningCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
                      {notice}
                    </p>
                  )}

                  <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-[380px] text-[12.5px] leading-relaxed text-foreground/55">
                      Vos coordonnées servent uniquement à vous répondre. Voir notre{' '}
                      <Link
                        href="/app/confidentialite"
                        onClick={() => dialog.current?.close()}
                        className="text-foreground/80 underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground"
                      >
                        politique de confidentialité
                      </Link>
                      .
                    </p>
                    <SlantMorphButton
                      type="submit"
                      disabled={sending}
                      className="w-full shrink-0 sm:w-auto [&>span:first-child]:flex-1 [&>span:first-child]:justify-center sm:[&>span:first-child]:flex-none"
                    >
                      {sending ? 'Envoi…' : 'Envoyer le message'}
                    </SlantMorphButton>
                  </div>
                </form>
              )}
            </div>
          </div>
          <span aria-hidden="true" className="tk-frame-rim" />
        </div>
      </div>
    </dialog>
  );
}
