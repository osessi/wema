import { Fragment } from "react";
import { ToneWord } from "../../wa/components/v2/journey/figure";
import { SectionHeading } from "../../wa/components/v2/primitives";
import {
  FigureCopy,
  FigureProfile,
  FigureVariants,
  FigureWeek,
} from "./figures";
import { CameraIcon, ExamIcon, ProfileIcon, RepeatIcon } from "./icons";
import { type MethodCard, MethodStack } from "./method-stack";

const STEPS: readonly MethodCard[] = [
  {
    id: "etape-profil",
    name: "Faire connaissance",
    tone: "gold",
    icon: ProfileIcon,
    title: [
      "Il apprend d'abord",
      <Fragment key="accent">
        <ToneWord tone="gold">qui est l'élève.</ToneWord>
      </Fragment>,
    ],
    body: "Un premier entretien, offert, complété par le parent et le prof. Il en ressort un profil : acquis, erreurs qui reviennent, formats qui aident. Chaque point a une source, une confiance et des preuves.",
    youSet: ["Ce que vous déclarez", "Les besoins à prendre en compte"],
    adapted: ["Ses acquis", "Ses erreurs", "Son rythme"],
    Figure: FigureProfile,
  },
  {
    id: "etape-exercices",
    name: "S'entraîner",
    tone: "emerald",
    icon: ExamIcon,
    title: [
      "Chaque exercice",
      <Fragment key="accent">
        <ToneWord tone="emerald">taillé pour lui.</ToneWord>
      </Fragment>,
    ],
    body: "La notion évaluée reste la même ; la difficulté, les indices, le contexte et la forme changent. Lecture facile, bande dessinée, schéma ou audio. En maths, chaque variante passe par le moteur de calcul avant d'être proposée.",
    youSet: ["Les exercices du prof", "Le rythme de la semaine"],
    adapted: ["Difficulté", "Indices", "Contexte", "Forme"],
    Figure: FigureVariants,
  },
  {
    id: "etape-copie",
    name: "Relire la copie",
    tone: "crimson",
    icon: CameraIcon,
    title: [
      "Une photo de la copie,",
      <Fragment key="accent">
        <ToneWord tone="crimson">les erreurs comprises.</ToneWord>
      </Fragment>,
    ],
    body: "L'élève photographie son contrôle corrigé. Le prof IA repère les erreurs, retrouve les notions en cause et les fait retravailler. Il ne réécrit pas la copie à sa place.",
    youSet: ["Les copies partagées", "Qui les voit"],
    adapted: ["Les notions à revoir", "Les exercices qui suivent"],
    Figure: FigureCopy,
  },
  {
    id: "etape-revisions",
    name: "Revenir dessus",
    tone: "indigo",
    icon: RepeatIcon,
    title: [
      "Il relance, puis",
      <Fragment key="accent">
        <ToneWord tone="indigo">fait réviser au bon moment.</ToneWord>
      </Fragment>,
    ],
    body: "Un exercice laissé en plan ? Il relance. Une notion vue lundi ? Il la refait travailler quelques jours plus tard, puis à intervalles qui s'allongent, pour qu'elle tienne.",
    youSet: ["Les heures de relance", "Le résumé du dimanche"],
    adapted: ["L'écart entre révisions", "Les notions fragiles"],
    Figure: FigureWeek,
  },
];

export function Method() {
  return (
    <section
      id="methode"
      aria-labelledby="methode-title"
      className="relative scroll-mt-28 px-4 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <SectionHeading
          id="methode-title"
          eyebrow="La méthode"
          title={[
            "Un vrai prof particulier,",
            <Fragment key="accent">
              <ToneWord tone="brand">en quatre gestes.</ToneWord>
            </Fragment>,
          ]}
          sub="Connaître l'élève, l'entraîner sur mesure, relire ses copies, revenir sur ce qui coince. Comme un bon prof particulier, chaque semaine."
        />
        <MethodStack steps={STEPS} />
      </div>
    </section>
  );
}
