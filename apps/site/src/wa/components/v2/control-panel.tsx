'use client';

import { cn } from '../../ui/lib/utils';
import type { ReactNode } from 'react';
import { Logo, sceneReveal, useSceneStep } from './doors-motion';
import { Frame } from './primitives';

function Cell({
  label,
  title,
  children,
  className,
}: {
  readonly label: string;
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-5 bg-[#151610] p-6 sm:p-7', className)}>
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-white/60 uppercase">
          {label}
        </span>
        <h3 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-white sm:text-[24px]">
          {title}
        </h3>
      </div>
      <div className="flex flex-1 flex-col justify-end">{children}</div>
    </div>
  );
}

function ApprovalCell() {
  const { ref, step } = useSceneStep<HTMLDivElement>(3, 1600, 3200);
  const autopilot = step === 2;
  return (
    <Cell label="Validation" title="Rien ne part sans votre accord.">
      <div ref={ref} className="flex flex-col gap-3">
        <div className="relative grid grid-cols-2 rounded-[10px] bg-white/[0.06] p-1">
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-[7px] bg-white transition-transform duration-500 ease-out',
              autopilot && 'translate-x-full',
            )}
          />
          <span
            className={cn(
              'relative py-2 text-center text-[14px] font-semibold transition-colors duration-500',
              autopilot ? 'text-white/65' : 'text-[#0D0E0B]',
            )}
          >
            Chaque vidéo
          </span>
          <span
            className={cn(
              'relative py-2 text-center text-[14px] font-semibold transition-colors duration-500',
              autopilot ? 'text-[#0D0E0B]' : 'text-white/65',
            )}
          >
            Le planning du mois
          </span>
        </div>
        <div className="rounded-[12px] border border-white/10 bg-white/[0.04] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-[13px] font-medium text-white/70">
              Vidéo · Instagram · mardi 12:00
            </span>
            <span
              className={cn(
                'shrink-0 rounded-[6px] px-2 py-0.5 font-mono text-[12px] font-semibold',
                step === 0 ? 'bg-[#F5C451] text-[#0D0E0B]' : 'bg-brand text-[#0D0E0B]',
              )}
            >
              {step === 0 ? 'En attente de vous' : autopilot ? 'Planning validé' : 'Validée'}
            </span>
          </div>
          <p className="mt-2 text-[14px] leading-snug text-white/85">
            « 3 erreurs à éviter avant le 31 décembre », avec la mention du risque de perte en
            capital.
          </p>
          <div
            className={cn(
              'mt-3 flex gap-2',
              step === 0 ? 'opacity-100' : 'opacity-40',
              'transition-opacity',
            )}
          >
            <span className="rounded-[8px] bg-brand px-3 py-1.5 text-[13px] font-semibold text-[#0D0E0B]">
              Valider
            </span>
            <span className="rounded-[8px] border border-white/15 px-3 py-1.5 text-[13px] font-semibold text-white/80">
              Modifier
            </span>
          </div>
        </div>
      </div>
    </Cell>
  );
}

function TakeoverCell() {
  const { ref, step } = useSceneStep<HTMLDivElement>(3, 1500, 3500);
  return (
    <Cell label="Corrections" title="Une remarque, on corrige.">
      <div ref={ref} className="flex flex-col gap-2.5">
        <div className="flex justify-start">
          <p className="max-w-[88%] rounded-2xl rounded-bl-md bg-white/[0.08] px-3.5 py-2.5 text-[14px] leading-snug text-white/90">
            Pouvez-vous remplacer « rendement » par « objectif » ?
          </p>
        </div>
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-[10px] px-3 py-2 transition-colors duration-500',
            step >= 1 ? 'bg-brand/15' : 'bg-white/[0.04]',
          )}
        >
          <span className="text-[13px] font-medium text-white/85">
            {step >= 1
              ? 'Correction faite, publication en attente'
              : 'Votre demande est prise en compte'}
          </span>
          <span
            className={cn(
              'shrink-0 rounded-[8px] px-2.5 py-1 text-[13px] font-semibold transition-colors duration-500',
              step >= 1 ? 'bg-white/10 text-white/70' : 'bg-white text-[#0D0E0B]',
            )}
          >
            {step >= 1 ? 'Corrigée' : 'En cours'}
          </span>
        </div>
        <div className={cn('flex justify-end', sceneReveal(step >= 2))}>
          <p className="max-w-[88%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2.5 text-[14px] leading-snug text-[#0D0E0B]">
            C’est corrigé : la nouvelle version vous attend pour validation.
          </p>
        </div>
      </div>
    </Cell>
  );
}

const channels = [
  { name: 'Facebook', logo: '/brands/facebook.svg' },
  { name: 'Instagram', logo: '/brands/instagram.svg' },
  { name: 'Google', logo: '/brands/google.svg' },
  { name: 'YouTube', logo: '/brands/youtube.svg' },
  { name: 'LinkedIn', logo: '/brands/linkedin.svg' },
] as const;

const mentions = [
  { metier: 'CGP', regle: 'AMF' },
  { metier: 'Courtier', regle: 'ORIAS' },
  { metier: 'Avocat', regle: 'Barreau' },
  { metier: 'École', regle: 'Taux publiés' },
] as const;

function OptOutCell() {
  const { ref, step } = useSceneStep<HTMLDivElement>(5, 550, 4000);
  return (
    <Cell label="Mentions obligatoires" title="Les règles de votre métier, intégrées.">
      <div ref={ref} className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <p className="rounded-2xl rounded-bl-md bg-white/[0.08] px-3.5 py-2 text-[14px] font-semibold text-white">
            Investir comporte un risque de perte en capital.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 min-[440px]:grid-cols-2">
          {mentions.map((mention, i) => {
            const off = step > i;
            return (
              <div
                key={mention.metier}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-[10px] border px-3 py-2.5 transition-colors duration-500',
                  off ? 'border-white/10 bg-white/[0.03]' : 'border-white/15 bg-white/[0.07]',
                )}
              >
                <span className="text-[14px] font-medium text-white/85">
                  {mention.metier} · {mention.regle}
                </span>
                <span
                  className={cn(
                    'font-mono text-[12px] font-semibold transition-colors duration-500',
                    off ? 'text-brand' : 'text-white/50',
                  )}
                >
                  {off ? 'Intégrée' : 'Vérification'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Cell>
  );
}

const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

function LimitsCell() {
  return (
    <Cell label="Calendrier" title="Publié au bon moment.">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium text-white/80">Vidéos par semaine</span>
            <span className="font-mono text-[14px] font-semibold text-white">2 / semaine</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[0, 1, 2, 3, 4].map((n) => (
              <span
                key={n}
                className={cn('h-2 rounded-full', n < 2 ? 'bg-brand' : 'bg-white/10')}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium text-white/80">Heures de publication</span>
            <span className="font-mono text-[14px] font-semibold text-white">08:00 – 18:00</span>
          </div>
          <div className="relative h-8 overflow-hidden rounded-[8px] bg-white/[0.06]">
            <span className="absolute inset-y-0 left-[33.33%] w-[41.67%] bg-brand/85" />
            <span className="control-now absolute inset-y-0 w-0.5 bg-white" />
          </div>
          <div className="flex justify-between font-mono text-[12px] text-white/55">
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>24</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-white/60">Quand vos clients regardent</span>
            <div className="flex gap-1">
              {days.map((day, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday list, letters repeat
                  key={i}
                  className={cn(
                    'grid size-6 place-items-center rounded-[6px] text-[12px] font-semibold',
                    i < 5 ? 'bg-white text-[#0D0E0B]' : 'bg-white/[0.06] text-white/45',
                  )}
                >
                  {day}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Cell>
  );
}

export function ControlPanel() {
  return (
    <Frame tone="graphite">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4 sm:px-7">
        <span className="text-[15px] font-semibold text-white">Vos règles</span>
        <span className="flex items-center gap-3 font-mono text-[12px] font-medium text-white/60">
          <span className="hidden min-[420px]:inline">Sur chaque réseau</span>
          <span className="flex items-center gap-1.5">
            {channels.map((channel) => (
              <span
                key={channel.name}
                title={channel.name}
                className="grid size-6 place-items-center rounded-[7px] border border-white/10 bg-white/[0.06]"
              >
                <Logo src={channel.logo} alt={channel.name} className="size-3.5 object-contain" />
              </span>
            ))}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-px bg-white/10 md:grid-cols-2">
        <ApprovalCell />
        <TakeoverCell />
        <OptOutCell />
        <LimitsCell />
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-white/10 px-6 py-4 sm:px-7">
        <span className="text-[14px] font-medium text-white/75">
          Chaque contenu vous est soumis avant publication
        </span>
        <span className="font-mono text-[12px] font-semibold tracking-[0.06em] text-white/75 uppercase">
          Conforme RGPD
        </span>
      </div>
    </Frame>
  );
}
