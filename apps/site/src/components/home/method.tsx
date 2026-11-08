import type { Icon } from "@phosphor-icons/react";
import {
  CalendarCheck,
  Camera,
  Shapes,
  UserFocus,
} from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import {
  Chip,
  Frame,
  GlowTile,
  Mono,
  SectionHead,
  type StyleVars,
} from "../kit";
import {
  CopyFigure,
  ProfileFigure,
  VariantsFigure,
  WeekFigure,
} from "./figures";

type Step = {
  tag: string;
  icon: Icon;
  tone: string;
  lead: string;
  follow: string;
  text: string;
  chips: string[];
  figure: ReactNode;
};

const STEPS: readonly Step[] = [
  {
    tag: "Faire connaissance",
    icon: UserFocus,
    tone: "#ffc529",
    lead: "Il apprend",
    follow: "qui est l'élève.",
    text: "Un premier entretien avec le prof IA, complété par le parent et le prof. Il en ressort un profil : ses acquis, ses erreurs qui reviennent, les formats qui l'aident. Chaque point vient avec sa preuve.",
    chips: ["Ses acquis", "Son rythme", "Ses formats"],
    figure: <ProfileFigure />,
  },
  {
    tag: "S'entraîner",
    icon: Shapes,
    tone: "#bfefd9",
    lead: "Chaque exercice",
    follow: "taillé pour lui.",
    text: "La notion évaluée reste la même ; la difficulté, les indices, le contexte et la forme changent. Lecture facile, bande dessinée, schéma ou audio : Wema garde ce qui marche pour lui.",
    chips: ["Difficulté", "Indices", "Forme"],
    figure: <VariantsFigure />,
  },
  {
    tag: "Relire la copie",
    icon: Camera,
    tone: "#f7c6d9",
    lead: "Une photo de la copie,",
    follow: "et on retravaille.",
    text: "L'élève photographie son contrôle corrigé. Le prof IA repère les erreurs, les relie aux notions du programme et lui fait retravailler exactement ce qui a coincé.",
    chips: ["Erreurs repérées", "Notions liées"],
    figure: <CopyFigure />,
  },
  {
    tag: "Tenir dans la durée",
    icon: CalendarCheck,
    tone: "#ffe89a",
    lead: "Il revient,",
    follow: "il relance.",
    text: "Il demande si le devoir est fait, revient sur une notion quelques jours plus tard pour qu'elle reste, et prévient le parent quand il le faut. Chaque réponse met le profil à jour.",
    chips: ["Relances", "Révisions espacées", "Bilan"],
    figure: <WeekFigure />,
  },
];

function stackStyle(i: number): StyleVars {
  return { "--i": i };
}

export function Method() {
  return (
    <section id="methode" className="relative px-4 py-24 sm:py-32">
      <SectionHead
        eyebrow="La méthode"
        lead="Ce qu'un bon prof particulier fait,"
        follow="pour chaque élève."
        text="Connaître l'élève, adapter, corriger, revenir. Quatre gestes que Wema répète avec chacun, à son rythme."
      />
      <ol className="mx-auto mt-16 max-w-6xl space-y-8 pb-8">
        {STEPS.map((step, i) => {
          const StepIcon = step.icon;
          return (
            <li key={step.tag} className="stack-card" style={stackStyle(i)}>
              <Frame
                as="article"
                cut={18}
                className="bg-surface shadow-[0_-12px_40px_-28px_rgb(22_21_18/0.35)]"
              >
                <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_1.15fr] [&>*]:min-w-0 lg:gap-12 lg:p-10">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <GlowTile
                        tone={step.tone}
                        size={38}
                        className="rounded-[10px]"
                      >
                        <StepIcon size={19} weight="bold" />
                      </GlowTile>
                      <Mono className="text-[12px] text-ink">
                        <span className="font-semibold">
                          {i + 1}/{STEPS.length}
                        </span>
                        <span className="text-ink-muted uppercase">
                          {" "}
                          · {step.tag}
                        </span>
                      </Mono>
                    </div>
                    <h3 className="mt-6 font-display text-[clamp(1.9rem,3.4vw,2.7rem)] leading-[1.05] font-light tracking-[-0.03em]">
                      <span className="block">{step.lead}</span>
                      <span className="block text-brand-ink">
                        {step.follow}
                      </span>
                    </h3>
                    <p className="mt-4 max-w-[46ch] text-[16px] leading-relaxed text-ink-muted">
                      {step.text}
                    </p>
                    <div className="mt-8 border-t border-line-strong pt-4 lg:mt-auto">
                      <Mono className="text-ink-muted uppercase">
                        Adapté à chaque élève
                      </Mono>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {step.chips.map((chip) => (
                          <Chip key={chip}>{chip}</Chip>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="min-h-[300px]">{step.figure}</div>
                </div>
              </Frame>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
