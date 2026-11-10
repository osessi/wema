"use client";

import { Check } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { sceneReveal, useSceneStep } from "../../wa/components/v2/doors-motion";
import { Frame } from "../../wa/components/v2/primitives";
import { cn } from "../../wa/ui/lib/utils";

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
    <div
      className={cn("flex flex-col gap-5 bg-[#151610] p-6 sm:p-7", className)}
    >
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

/* Exemples fictifs : noms de classes et chiffres d'illustration. */
const CLASSES = [
  {
    name: "4e A · Maths",
    program: "France · Cycle 4",
    teachers: 1,
    learners: 26,
  },
  {
    name: "3e B · Maths",
    program: "France · Cycle 4",
    teachers: 2,
    learners: 24,
  },
  {
    name: "4e · Maths",
    program: "Bénin · 1er cycle",
    teachers: 1,
    learners: 31,
  },
] as const;

function ClassesCell() {
  const { ref, step } = useSceneStep<HTMLDivElement>(4, 1100, 3600);
  return (
    <Cell label="Classes" title="Une classe, un programme.">
      <div ref={ref} className="flex flex-col gap-2">
        {CLASSES.map((k, i) => (
          <div
            key={k.name}
            className={cn(
              "flex items-center justify-between gap-3 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5",
              sceneReveal(i < Math.max(1, step)),
            )}
          >
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-white">
                {k.name}
              </span>
              <span className="block truncate font-mono text-[11.5px] text-white/55">
                {k.program}
              </span>
            </span>
            <span className="shrink-0 text-right font-mono text-[11.5px] text-white/70">
              {k.teachers} prof{k.teachers > 1 ? "s" : ""}
              <br />
              {k.learners} élèves
            </span>
          </div>
        ))}
        <span className="mt-1 inline-flex self-start rounded-[8px] bg-brand px-3 py-1.5 text-[13px] font-semibold text-[#0D0E0B]">
          Créer une classe
        </span>
      </div>
    </Cell>
  );
}

const ROLES = [
  {
    name: "Direction",
    perms: [true, true, true, true, true, true],
  },
  {
    name: "Prof",
    perms: [false, false, true, true, true, false],
  },
  {
    name: "Vie scolaire",
    perms: [false, true, false, true, false, true],
  },
] as const;

const PERMS = [
  "Gérer les rôles",
  "Gérer les membres",
  "Créer des exercices",
  "Voir le profil des élèves",
  "Compléter le profil des élèves",
  "Consulter le journal",
] as const;

function RolesCell() {
  const { ref, step } = useSceneStep<HTMLDivElement>(3, 2200, 2600);
  const role = ROLES[step] ?? ROLES[0];
  return (
    <Cell label="Rôles et droits" title="Chacun voit ce que son rôle permet.">
      <div ref={ref} className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-1 rounded-[10px] bg-white/[0.06] p-1">
          {ROLES.map((r, i) => (
            <span
              key={r.name}
              className={cn(
                "truncate rounded-[7px] py-1.5 text-center text-[13px] font-semibold transition-colors duration-500",
                i === step ? "bg-white text-[#0D0E0B]" : "text-white/65",
              )}
            >
              {r.name}
            </span>
          ))}
        </div>
        <ul className="flex flex-col gap-1">
          {PERMS.map((p, i) => {
            const on = role.perms[i] === true;
            return (
              <li
                key={p}
                className="flex items-center justify-between gap-3 text-[13.5px]"
              >
                <span
                  className={cn(
                    "transition-colors duration-500",
                    on ? "text-white/90" : "text-white/40",
                  )}
                >
                  {p}
                </span>
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors duration-500",
                    on
                      ? "border-brand bg-brand text-[#0D0E0B]"
                      : "border-white/20",
                  )}
                >
                  {on ? <Check size={10} weight="bold" /> : null}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-[12.5px] leading-snug text-white/55">
          On ne donne que des permissions que l'on détient soi-même.
        </p>
      </div>
    </Cell>
  );
}

const LOGINS = [
  { kind: "E-mail", who: "Mme Adjovi", role: "Prof" },
  { kind: "Téléphone", who: "M. Laurent", role: "Vie scolaire" },
  { kind: "Identifiant élève", who: "Awa D.", role: "Élève" },
] as const;

function MembersCell() {
  const { ref, step } = useSceneStep<HTMLDivElement>(4, 1200, 3200);
  return (
    <Cell label="Membres" title="Ajouter un prof ou un élève en un instant.">
      <div ref={ref} className="flex flex-col gap-2">
        {LOGINS.map((m, i) => (
          <div
            key={m.who}
            className={cn(
              "flex items-center justify-between gap-3 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2",
              sceneReveal(i < Math.max(1, step)),
            )}
          >
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-white">
                {m.who}
              </span>
              <span className="block font-mono text-[11.5px] text-white/55">
                {m.kind}
              </span>
            </span>
            <span className="shrink-0 rounded-[6px] bg-white/10 px-2 py-0.5 font-mono text-[12px] font-semibold text-white/85">
              {m.role}
            </span>
          </div>
        ))}
        <p className="mt-1 text-[12.5px] leading-snug text-white/55">
          Les élèves s'inscrivent en masse par import d'un fichier. Un élève
          sans e-mail ni téléphone reçoit un identifiant et un code de
          connexion, affiché une seule fois.
        </p>
      </div>
    </Cell>
  );
}

const PROGRESS = [
  { name: "4e A", mastered: 62, active: 88 },
  { name: "3e B", mastered: 48, active: 71 },
  { name: "4e", mastered: 55, active: 0 },
] as const;

function FollowCell() {
  const { ref, step } = useSceneStep<HTMLDivElement>(2, 2600, 3400);
  const lit = step >= 1;
  return (
    <Cell label="Suivi par classe" title="Les classes en un coup d'œil.">
      <div ref={ref} className="flex flex-col gap-3">
        <div className="flex gap-4 font-mono text-[11px] text-white/60 uppercase">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px] bg-brand" />
            Notions validées
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px] bg-white/45" />
            Actifs cette semaine
          </span>
        </div>
        {PROGRESS.map((k) => (
          <div
            key={k.name}
            className="grid grid-cols-[44px_1fr] items-center gap-3"
          >
            <span className="text-[13px] font-semibold text-white">
              {k.name}
            </span>
            <div className="flex flex-col gap-1">
              <span className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <span
                  className="block h-full rounded-full bg-brand transition-[width] duration-1000 ease-out"
                  style={{ width: `${lit ? k.mastered : 8}%` }}
                />
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <span
                  className="block h-full rounded-full bg-white/45 transition-[width] duration-1000 ease-out"
                  style={{ width: `${lit ? k.active : 4}%` }}
                />
              </span>
            </div>
          </div>
        ))}
        <p
          className={cn(
            "rounded-[10px] border border-[#FF4D5E]/40 bg-[#FF4D5E]/10 px-3 py-2 text-[13px] leading-snug text-white/90",
            sceneReveal(lit),
          )}
        >
          À surveiller : aucun élève de « 4e » n'a travaillé cette semaine.
        </p>
      </div>
    </Cell>
  );
}

function ContractCell() {
  const { ref, step } = useSceneStep<HTMLDivElement>(2, 2400, 3600);
  return (
    <Cell label="Facturation" title="Un contrat, toutes les matières.">
      <div ref={ref} className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5">
          <span className="text-[14px] font-semibold text-white">
            Votre établissement
          </span>
          <span className="rounded-[6px] bg-brand px-2 py-0.5 font-mono text-[12px] font-semibold text-[#0D0E0B]">
            Sous contrat
          </span>
        </div>
        <ul className="flex flex-col gap-1.5 text-[13.5px] text-white/80">
          <li className="flex items-center gap-2">
            <Check size={13} weight="bold" className="text-brand" />
            Facturation sur mesure, hors paiement en ligne
          </li>
          <li className="flex items-center gap-2">
            <Check size={13} weight="bold" className="text-brand" />
            Toutes les matières ouvertes à vos élèves
          </li>
          <li className="flex items-center gap-2">
            <Check size={13} weight="bold" className="text-brand" />
            Aucun abonnement individuel
          </li>
        </ul>
        <div
          className={cn(
            "rounded-2xl rounded-bl-md bg-white/[0.08] px-3.5 py-2.5",
            sceneReveal(step >= 1),
          )}
        >
          <span className="block font-mono text-[11px] text-white/55 uppercase">
            Ce que voit le parent
          </span>
          <span className="mt-1 block text-[13.5px] leading-snug text-white/90">
            Son établissement a un contrat avec Wema : toutes les matières sont
            incluses, rien à payer.
          </span>
        </div>
      </div>
    </Cell>
  );
}

const JOURNAL = [
  ["Classe créée", "Direction"],
  ["Inscription dans une classe", "Direction"],
  ["Exercice validé", "Mme Adjovi"],
  ["Devoir donné", "Mme Adjovi"],
  ["Rôle attribué", "Direction"],
] as const;

function JournalCell() {
  const { ref, step } = useSceneStep<HTMLDivElement>(5, 900, 3000);
  return (
    <Cell label="Journal" title="Chaque action est tracée.">
      <div ref={ref} className="flex flex-col">
        {JOURNAL.map(([action, by], i) => (
          <div
            key={action}
            className={cn(
              "flex items-center justify-between gap-3 border-b border-white/10 py-2 last:border-b-0",
              sceneReveal(i <= step),
            )}
          >
            <span className="truncate text-[13.5px] text-white/85">
              {action}
            </span>
            <span className="shrink-0 font-mono text-[11.5px] text-white/55">
              {by}
            </span>
          </div>
        ))}
        <p className="mt-3 text-[12.5px] leading-snug text-white/55">
          Les besoins de santé ne sont visibles qu'avec le consentement du
          parent et la permission adaptée.
        </p>
      </div>
    </Cell>
  );
}

const TABS = ["Vue d'ensemble", "Classes", "Membres", "Journal"] as const;

export function SchoolPanel() {
  return (
    <Frame tone="graphite">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4 sm:px-7">
        <span className="text-[15px] font-semibold text-white">
          Votre établissement
          <span className="font-normal text-white/50"> · exemple</span>
        </span>
        <span className="flex flex-wrap gap-1.5">
          {TABS.map((t, i) => (
            <span
              key={t}
              className={cn(
                "rounded-[7px] border px-2.5 py-1 font-mono text-[11.5px] font-medium",
                i === 0
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/10 text-white/55",
              )}
            >
              {t}
            </span>
          ))}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-px bg-white/10 md:grid-cols-2 lg:grid-cols-3">
        <ClassesCell />
        <RolesCell />
        <MembersCell />
        <FollowCell />
        <ContractCell />
        <JournalCell />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 px-6 py-4 sm:px-7">
        <span className="text-[14px] font-medium text-white/75">
          Pour une école ou un réseau de profs
        </span>
        <span className="font-mono text-[12px] font-semibold tracking-[0.06em] text-white/75 uppercase">
          Élèves sous contrat · rien à payer pour les familles
        </span>
      </div>
    </Frame>
  );
}
