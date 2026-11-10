import { Fragment } from "react";
import { GlowIcon } from "../../wa/components/v2/glow-icon";
import { ToneWord } from "../../wa/components/v2/journey/figure";
import {
  type JourneyCard,
  JourneyStack,
} from "../../wa/components/v2/journey/journey-stack";
import { Frame, SectionHeading } from "../../wa/components/v2/primitives";
import {
  BooksIcon,
  CalendarCheckIcon,
  ChartLineUpIcon,
  ChatsCircleIcon,
  CursorClickIcon,
  MagnifyingGlassIcon,
  TargetIcon,
  UsersThreeIcon,
} from "../../wa/ui/icons";
import { cn } from "../../wa/ui/lib/utils";
import { FigureBank } from "./figure-bank";
import { FigureDeposit } from "./figure-deposit";
import { FigureTracking } from "./figure-tracking";
import { FigureVariants } from "./figure-variants";

const STEPS: readonly JourneyCard[] = [
  {
    id: "semaine-banque",
    name: "Lundi · la banque",
    tone: "ember",
    icon: BooksIcon,
    title: [
      "Des exercices prêts,",
      <Fragment key="accent">
        sur <ToneWord tone="ember">votre programme</ToneWord>.
      </Fragment>,
    ],
    body: "Chaque semaine, Wema propose des exercices pour les notions que vos classes travaillent ou abordent bientôt. Chacun est vérifié par le calcul avant d'entrer dans la banque. Vous retenez ceux qui conviennent et vous écartez les autres.",
    youSet: ["Ce que vous retenez", "Ce que vous écartez", "La semaine"],
    Figure: FigureBank,
  },
  {
    id: "semaine-depot",
    name: "Vos exercices",
    tone: "gold",
    icon: CursorClickIcon,
    title: [
      "Vos énoncés",
      <Fragment key="accent">
        ont leur <ToneWord tone="gold">place</ToneWord>.
      </Fragment>,
    ],
    body: "Vous écrivez un exercice : la notion évaluée, l'idée fausse ciblée, l'énoncé et les plages de valeurs. Le moteur de calcul en tire une variante vérifiée par niveau, puis vous le déposez dans la banque. Vous pouvez aussi puiser dans la bibliothèque Wema.",
    youSet: ["L'énoncé", "La notion", "L'idée fausse ciblée"],
    Figure: FigureDeposit,
  },
  {
    id: "semaine-variantes",
    name: "Le devoir",
    tone: "orchid",
    icon: UsersThreeIcon,
    title: [
      "Un seul devoir,",
      <Fragment key="accent">
        une <ToneWord tone="orchid">variante</ToneWord> par élève.
      </Fragment>,
    ],
    body: "Vous donnez l'exercice à la classe ou à un élève. Ce qui est évalué reste le même pour tous ; la difficulté, les indices, le contexte et la forme changent selon le profil de chacun : lecture facile, étapes guidées, schéma.",
    youSet: ["L'exercice", "La classe", "L'échéance"],
    Figure: FigureVariants,
  },
  {
    id: "semaine-suivi",
    name: "Le suivi",
    tone: "crimson",
    icon: ChartLineUpIcon,
    title: [
      "Qui a compris,",
      <Fragment key="accent">
        qui <ToneWord tone="crimson">bloque</ToneWord>, et sur quoi.
      </Fragment>,
    ],
    body: "Entre deux cours, le prof IA accompagne chaque élève sans lui donner la réponse. La carte de la classe montre où en est chacun sur chaque notion, et les idées fausses partagées par plusieurs élèves, à reprendre ensemble.",
    youSet: ["Ce que vous reprenez en cours", "Vos observations"],
    Figure: FigureTracking,
  },
];

const AROUND = [
  {
    title: "Agenda et visio",
    text: "Vos disponibilités, vos séances en visio et vos groupes de révision. Les parents réservent un créneau libre ; après la séance, vous rédigez son compte rendu.",
    tone: "indigo",
    icon: CalendarCheckIcon,
  },
  {
    title: "Messagerie",
    text: "Vous échangez avec vos élèves, leurs parents et les autres profs avec qui vous êtes en lien, au même endroit.",
    tone: "emerald",
    icon: ChatsCircleIcon,
  },
  {
    title: "Une fiche par élève",
    text: "Sa progression par notion et ses dernières réponses. Chaque affirmation du profil a sa source, sa confiance et ses preuves.",
    tone: "ember",
    icon: MagnifyingGlassIcon,
  },
  {
    title: "Vos observations comptent",
    text: "« Comprend mieux avec des schémas », « préfère des séances courtes » : vous l'ajoutez à sa fiche, et le prof IA en tient compte.",
    tone: "orchid",
    icon: TargetIcon,
  },
] as const;

const COPY = {
  profs: {
    eyebrow: "La semaine d'un prof",
    sub: "Pour un groupe ou pour un seul élève, la semaine suit les mêmes quatre temps. Rien n'est envoyé à un élève sans votre choix.",
  },
  ecoles: {
    eyebrow: "La semaine de vos enseignants",
    sub: "Dans chaque classe, la semaine suit les mêmes quatre temps. Rien n'est envoyé à un élève sans le choix de son prof.",
  },
} as const;

export function TeacherWeek({
  audience,
}: {
  readonly audience: "profs" | "ecoles";
}) {
  const copy = COPY[audience];
  // L'agenda et la réservation de séances par les parents concernent les cours particuliers.
  const around =
    audience === "profs"
      ? AROUND
      : AROUND.filter((item) => item.title !== "Agenda et visio");
  return (
    <section
      id="profs"
      data-section="journey"
      aria-labelledby="week-title"
      className="relative scroll-mt-24 px-4 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <SectionHeading
          id="week-title"
          eyebrow={copy.eyebrow}
          title={[
            "Vous choisissez les exercices.",
            <Fragment key="accent">
              Wema les adapte à <ToneWord tone="brand">chaque élève.</ToneWord>
            </Fragment>,
          ]}
          sub={copy.sub}
        />
        <JourneyStack steps={STEPS} />

        <div className="mt-24 sm:mt-28">
          <div className="flex items-center gap-3 border-b border-[var(--tk-rule)] pb-3 font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
            <span className="tk-diamond" data-outline="" aria-hidden="true" />
            Autour de la semaine
          </div>
          <ul
            className={cn(
              "mt-6 grid gap-4 sm:grid-cols-2",
              around.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
            )}
          >
            {around.map((item) => (
              <li key={item.title}>
                <Frame className="h-full">
                  <div className="flex h-full flex-col gap-4 p-5 sm:p-6">
                    <GlowIcon tone={item.tone} icon={item.icon} size={44} />
                    <h3 className="text-[19px] leading-tight font-semibold tracking-[-0.015em] text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-[15px] leading-relaxed text-foreground/75">
                      {item.text}
                    </p>
                  </div>
                </Frame>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
