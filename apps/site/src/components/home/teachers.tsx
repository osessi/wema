"use client";

import {
  ArrowRight,
  CheckSquare,
  Square,
  UploadSimple,
  VideoCamera,
} from "@phosphor-icons/react";
import { sceneReveal, useSceneStep } from "../../wa/components/v2/doors-motion";
import { TONE_HEX, TonePill } from "../../wa/components/v2/journey/figure";
import { SectionHeading } from "../../wa/components/v2/primitives";
import { TsfLink } from "../../wa/components/v2/tsf/tsf-cta";
import { cn } from "../../wa/ui/lib/utils";
import { DoorCard, Key, Stage } from "./door-card";
import { SchoolIcon, StudentIcon, TeacherIcon } from "./icons";

const MONO =
  "font-mono text-[10.5px] tracking-[0.08em] text-muted-foreground uppercase";

/* Enseignants : banque de la semaine, choix du prof, déclinaison par élève. */

const BANK = [
  { title: "Aire du rectangle", level: "5e", pick: true },
  { title: "Fractions : même dénominateur", level: "5e", pick: false },
  { title: "Périmètre et aire, la différence", level: "5e", pick: true },
  { title: "Priorités de calcul", level: "5e", pick: false },
] as const;

const STUDENTS = [
  { name: "Inès", form: "Lecture facile", tone: "emerald" },
  { name: "Kofi", form: "Avec un schéma", tone: "indigo" },
  { name: "Léa", form: "Plus difficile", tone: "orchid" },
  { name: "Yanis", form: "Indices en plus", tone: "ember" },
] as const;

function BankStage() {
  const { ref, step } = useSceneStep<HTMLDivElement>(5, 1100, 3600);
  const picked = step >= 1;
  const own = step >= 2;
  const fanned = step >= 3;
  return (
    <Stage>
      <div
        ref={ref}
        className="grid flex-1 grid-cols-1 gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] md:items-center"
      >
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className={MONO}>Banque · semaine 46</span>
            <TonePill tone="neutral">Programme 5e</TonePill>
          </div>
          <ul className="flex flex-col gap-1.5">
            {BANK.map((ex) => {
              const on = ex.pick && picked;
              return (
                <li
                  key={ex.title}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[10px] border bg-surface px-3 py-2 transition-colors duration-500",
                    on ? "border-[var(--tk-rule)]" : "border-[var(--tk-line)]",
                  )}
                >
                  {on ? (
                    <CheckSquare
                      size={16}
                      weight="fill"
                      className="shrink-0 text-brand-active dark:text-brand"
                    />
                  ) : (
                    <Square size={16} className="shrink-0 text-foreground/35" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                    {ex.title}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {ex.level}
                  </span>
                </li>
              );
            })}
            <li
              className={cn(
                "flex items-center gap-2.5 rounded-[10px] border border-dashed border-[var(--tk-rule)] bg-surface px-3 py-2",
                sceneReveal(own),
              )}
            >
              <UploadSimple size={16} className="shrink-0 text-foreground/70" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                Votre fiche : « Le carrelage de la classe »
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                Déposée
              </span>
            </li>
          </ul>
        </div>

        <div className="hidden justify-center md:flex">
          <span
            className={cn(
              "grid size-9 place-items-center rounded-full border transition-colors duration-500",
              fanned
                ? "border-transparent bg-brand text-[#0D0E0B]"
                : "border-[var(--tk-line)] bg-surface text-foreground/50",
            )}
          >
            <ArrowRight size={16} weight="bold" />
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className={MONO}>Décliné pour chaque élève</span>
            <span className="font-mono text-[11px] font-semibold text-foreground">
              {fanned ? "3 exercices × 24" : "··"}
            </span>
          </div>
          <ul className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">
            {STUDENTS.map((st, i) => (
              <li
                key={st.name}
                className={cn(
                  "rounded-[10px] border border-[var(--tk-line)] bg-surface px-3 py-2",
                  sceneReveal(fanned && step >= 3 + (i > 1 ? 1 : 0)),
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-[#15160F]"
                    style={{ backgroundColor: TONE_HEX[st.tone] }}
                  >
                    {st.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-[13px] font-semibold text-foreground">
                    {st.name}
                  </span>
                </span>
                <span className="mt-1 block text-[12px] text-foreground/65">
                  {st.form}
                </span>
              </li>
            ))}
          </ul>
          <p className="font-mono text-[10.5px] text-muted-foreground">
            Même notion évaluée · calculs vérifiés
          </p>
        </div>
      </div>
    </Stage>
  );
}

/* Profs particuliers : agenda et séances en visio. */

const SLOTS = [
  { day: 0, top: 18, h: 26, who: "Kofi · 3e", visio: true },
  { day: 1, top: 52, h: 26, who: "Inès · 4e", visio: true },
  { day: 2, top: 10, h: 30, who: "Sami · 2de", visio: false },
  { day: 3, top: 60, h: 26, who: "Kofi · 3e", visio: true },
  { day: 4, top: 30, h: 26, who: "Léa · 1re", visio: true },
] as const;

function AgendaStage() {
  const { ref, step } = useSceneStep<HTMLDivElement>(
    SLOTS.length + 2,
    600,
    3600,
  );
  const next = step >= SLOTS.length;
  return (
    <Stage>
      <div ref={ref} className="flex flex-1 flex-col gap-3 p-4">
        <div className="grid flex-1 grid-cols-5 gap-1 rounded-[12px] border border-[var(--tk-line)] bg-surface p-1.5">
          {["Lun", "Mar", "Mer", "Jeu", "Ven"].map((d, di) => (
            <div
              key={d}
              className="relative min-h-[140px] border-[var(--tk-line)]"
            >
              <span className="block text-center font-mono text-[10px] text-muted-foreground uppercase">
                {d}
              </span>
              {SLOTS.map((sl, i) =>
                sl.day === di ? (
                  <span
                    key={`${sl.day}-${sl.who}`}
                    className={cn(
                      "absolute inset-x-0.5 overflow-hidden rounded-[6px] border px-1 py-0.5",
                      sceneReveal(step > i),
                    )}
                    style={{
                      top: `${sl.top}%`,
                      height: `${sl.h}%`,
                      borderColor: `color-mix(in srgb, ${TONE_HEX.indigo} 55%, transparent)`,
                      backgroundColor: `color-mix(in srgb, ${TONE_HEX.indigo} 16%, var(--surface))`,
                    }}
                  >
                    <span className="flex items-center gap-0.5">
                      {sl.visio ? (
                        <VideoCamera size={10} weight="fill" />
                      ) : null}
                    </span>
                    <span className="block truncate text-[9.5px] leading-tight font-semibold text-foreground">
                      {sl.who}
                    </span>
                  </span>
                ) : null,
              )}
            </div>
          ))}
        </div>
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-[10px] p-2.5 text-[#15160F]",
            sceneReveal(next),
          )}
          style={{ backgroundColor: TONE_HEX.indigo }}
        >
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/70">
            <VideoCamera size={16} weight="fill" />
          </span>
          <span className="min-w-0">
            <span className="block font-mono text-[9.5px] font-semibold tracking-[0.08em] uppercase opacity-75">
              Prochaine séance · lundi 17:00
            </span>
            <span className="block truncate text-[12px] font-semibold">
              Kofi · ce qu'il a travaillé depuis jeudi
            </span>
          </span>
        </div>
      </div>
    </Stage>
  );
}

/* Écoles et réseaux : suivi de classe, rôles, contrat. */

const CLASSES = [
  { name: "4e A", prof: "M. Houngbo", pct: 72, weak: "Aire" },
  { name: "4e B", prof: "Mme Martin", pct: 58, weak: "Équations" },
  { name: "3e A", prof: "M. Adjovi", pct: 81, weak: "Pythagore" },
] as const;

function SchoolStage() {
  const { ref, step } = useSceneStep<HTMLDivElement>(3, 1300, 3600);
  return (
    <Stage>
      <div ref={ref} className="flex flex-1 flex-col gap-3 p-4">
        <div className="overflow-hidden rounded-[12px] border border-[var(--tk-line)] bg-surface">
          <div className="grid grid-cols-[52px_minmax(0,1fr)_72px] gap-2 border-b border-[var(--tk-line)] px-3 py-1.5">
            <span className={MONO}>Classe</span>
            <span className={MONO}>Maîtrise</span>
            <span className={cn(MONO, "text-right")}>À revoir</span>
          </div>
          {CLASSES.map((c) => (
            <div
              key={c.name}
              className="grid grid-cols-[52px_minmax(0,1fr)_72px] items-center gap-2 border-b border-[var(--tk-line)] px-3 py-2 last:border-b-0"
            >
              <span className="text-[13px] font-semibold text-foreground">
                {c.name}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
                  <span
                    className="block h-full rounded-full bg-brand transition-[width] duration-700 ease-out"
                    style={{ width: `${step >= 1 ? c.pct : 8}%` }}
                  />
                </span>
                <span className="w-8 text-right font-mono text-[10.5px] text-foreground tabular-nums">
                  {step >= 1 ? `${c.pct}%` : "··"}
                </span>
              </span>
              <span className="truncate text-right text-[11.5px] text-foreground/70">
                {c.weak}
              </span>
            </div>
          ))}
        </div>
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5",
            sceneReveal(step >= 2),
          )}
        >
          <span className={MONO}>Rôles</span>
          <TonePill tone="gold">Direction</TonePill>
          <TonePill tone="indigo">Profs</TonePill>
          <TonePill tone="emerald">Élèves</TonePill>
          <TonePill tone="orchid">Parents</TonePill>
        </div>
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-[10px] border border-[var(--tk-line)] bg-surface p-2.5",
            sceneReveal(step >= 2),
          )}
        >
          <span className="mt-0.5 size-2 shrink-0 rounded-full bg-[#FF4D5E]" />
          <span className="min-w-0">
            <span className="block text-[12px] font-semibold text-foreground">
              4e B : les équations coincent
            </span>
            <span className="block text-[11.5px] text-foreground/65">
              Signalé au prof, avec les exercices où l'erreur revient
            </span>
          </span>
        </div>
        <p className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--tk-line)] pt-2.5 font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
          <span>Facturation sur contrat</span>
          <span>Exemple fictif</span>
        </p>
      </div>
    </Stage>
  );
}

export function Teachers() {
  return (
    <section
      id="profs"
      aria-labelledby="profs-title"
      className="relative scroll-mt-28 px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-14 sm:gap-16">
        <SectionHeading
          id="profs-title"
          eyebrow="Profs et écoles"
          title={[
            "Le prof garde la main.",
            <span key="l2" className="text-brand-active dark:text-brand">
              Wema fait le sur-mesure.
            </span>,
          ]}
          sub="Chaque semaine, une banque d'exercices sur le programme. Le prof choisit ou dépose les siens ; le prof IA les décline pour chaque élève et fait remonter ce qui coince."
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          <DoorCard
            className="lg:col-span-2"
            index="01"
            door="Enseignants"
            tone="gold"
            icon={TeacherIcon}
            title={
              <>
                Vous choisissez les exercices,{" "}
                <Key>chaque élève reçoit le sien.</Key>
              </>
            }
            body="Le lundi, la banque de la semaine arrive, calée sur le programme de la classe. Vous cochez, vous ajoutez vos fiches. Chaque élève reçoit sa version : même notion évaluée, forme et indices adaptés."
            aside={<TonePill tone="neutral">Banque chaque lundi</TonePill>}
          >
            <BankStage />
          </DoorCard>
          <DoorCard
            index="02"
            door="Profs particuliers"
            tone="indigo"
            icon={StudentIcon}
            title={
              <>
                Vos séances, <Key>préparées entre deux visios.</Key>
              </>
            }
            body="Agenda, séances en visio et suivi de chaque élève au même endroit. Entre deux séances, le prof IA le fait travailler et vous dit où il en est."
          >
            <AgendaStage />
          </DoorCard>
          <DoorCard
            index="03"
            door="Écoles et réseaux"
            tone="emerald"
            icon={SchoolIcon}
            title={
              <>
                Toutes vos classes, <Key>un seul tableau.</Key>
              </>
            }
            body="Classes, profs et rôles gérés par l'établissement. Le suivi par classe montre les notions à reprendre. La facturation se fait sur contrat."
          >
            <SchoolStage />
          </DoorCard>
        </div>

        <p className="text-center text-[16px] font-medium text-foreground/70">
          Comptes, rôles et déploiement dans un établissement :{" "}
          <TsfLink href="/profs-et-ecoles" className="font-medium">
            la page profs et écoles
          </TsfLink>
        </p>
      </div>
    </section>
  );
}
