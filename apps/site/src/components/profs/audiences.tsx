import { Fragment } from "react";
import { GlowIcon } from "../../wa/components/v2/glow-icon";
import { Frame, SectionHeading } from "../../wa/components/v2/primitives";
import { TsfLink } from "../../wa/components/v2/tsf/tsf-cta";
import type { GlowTone } from "../../wa/ui/components/ui/glow-tile";
import {
  type AnimatedIconHandle,
  type AnimatedIconProps,
  StrategyIcon,
  UsersThreeIcon,
} from "../../wa/ui/icons";

type Audience = {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly text: string;
  readonly tone: GlowTone;
  readonly icon: React.ComponentType<
    AnimatedIconProps & { ref?: React.Ref<AnimatedIconHandle> }
  >;
  readonly points: readonly string[];
  readonly link: string;
  readonly page: string;
  readonly anchor: string;
};

const AUDIENCES: readonly Audience[] = [
  {
    id: "profs",
    label: "Profs particuliers",
    title: "Vos élèves avancent aussi entre deux séances.",
    text: "Vous arrivez à chaque cours en sachant où en est l'élève, et le prof IA reprend le relais quand vous n'êtes pas là.",
    tone: "gold",
    icon: StrategyIcon,
    points: [
      "Vous vous inscrivez seul et créez vos groupes",
      "Vos élèves inscrits un par un ou en masse",
      "Une banque d'exercices chaque semaine, déclinée pour chaque élève",
      "Agenda, visio et messagerie avec les parents",
    ],
    link: "Voir la page des profs particuliers",
    page: "/profs-particuliers",
    anchor: "#profs",
  },
  {
    id: "ecoles",
    label: "Écoles et réseaux de profs",
    title: "Un devoir, une version par élève, dans chaque classe.",
    text: "Vos enseignants différencient sans y passer leurs soirées. La direction suit les classes notion par notion et garde la main sur les accès.",
    tone: "orchid",
    icon: UsersThreeIcon,
    points: [
      "Classes et programmes, élèves importés depuis un fichier",
      "Rôles et droits définis par vous",
      "Suivi par classe et journal des actions",
      "Facturation sur contrat, sans abonnement pour les familles",
    ],
    link: "Voir la page des écoles",
    page: "/ecoles",
    anchor: "#ecoles",
  },
];

/** Les deux publics ; celui de la page en premier, l'autre renvoie à sa page. */
export function Audiences({
  current,
}: {
  readonly current: "profs" | "ecoles";
}) {
  const audiences = [...AUDIENCES].sort(
    (a, b) => Number(b.id === current) - Number(a.id === current),
  );
  return (
    <section
      aria-labelledby="audiences-title"
      className="relative px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-14 sm:gap-16">
        <SectionHeading
          id="audiences-title"
          eyebrow="Pour qui"
          title={[
            "Deux façons d'enseigner,",
            <Fragment key="l2">
              <span className="text-brand-active dark:text-brand">
                les mêmes outils.
              </span>
            </Fragment>,
          ]}
          sub="Que vous suiviez quelques élèves en cours particuliers ou que vous dirigiez un établissement, la semaine se passe de la même façon. Ce qui change, c'est la gestion autour."
        />
        <div className="grid gap-5 md:grid-cols-2">
          {audiences.map((a) => (
            <Frame key={a.id} className="h-full">
              <article
                aria-labelledby={`aud-${a.id}`}
                className="flex h-full flex-col gap-6 p-6 sm:p-8"
              >
                <div className="flex items-center gap-4">
                  <GlowIcon
                    tone={a.tone}
                    icon={a.icon}
                    size={52}
                    idle="breathe"
                  />
                  <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-foreground/60 uppercase">
                    {a.label}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  <h3
                    id={`aud-${a.id}`}
                    className="text-[26px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance text-foreground sm:text-[30px]"
                  >
                    {a.title}
                  </h3>
                  <p className="text-[16px] leading-relaxed text-foreground/75 sm:text-[17px]">
                    {a.text}
                  </p>
                </div>
                <ul className="flex flex-col border-t border-foreground/10">
                  {a.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-3 border-b border-foreground/10 py-3 text-[15px] font-medium text-foreground/85"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-[7px] size-[7px] shrink-0 rotate-45 bg-brand"
                      />
                      {p}
                    </li>
                  ))}
                </ul>
                <TsfLink
                  href={a.id === current ? a.anchor : a.page}
                  className="mt-auto self-start text-[16px] font-medium"
                >
                  {a.id === current
                    ? a.id === "profs"
                      ? "Voir la semaine d'un prof"
                      : "Voir l'espace école"
                    : a.link}
                </TsfLink>
              </article>
            </Frame>
          ))}
        </div>
      </div>
    </section>
  );
}
