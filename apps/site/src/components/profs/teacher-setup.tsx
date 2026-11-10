import { Fragment } from "react";
import { GlowIcon } from "../../wa/components/v2/glow-icon";
import { Frame, SectionHeading } from "../../wa/components/v2/primitives";
import {
  ChatsCircleIcon,
  KanbanIcon,
  StrategyIcon,
  UsersThreeIcon,
} from "../../wa/ui/icons";

const STEPS = [
  {
    title: "Vous vous inscrivez seul.",
    text: "Vous ouvrez votre espace prof depuis l'application, sans passer par un établissement.",
    tone: "gold",
    icon: StrategyIcon,
  },
  {
    title: "Vous créez vos groupes.",
    text: "Vous rangez vos élèves dans vos groupes. Un devoir se donne à un groupe entier ou à un seul élève.",
    tone: "ember",
    icon: KanbanIcon,
  },
  {
    title: "Vous inscrivez vos élèves.",
    text: "Un par un ou en masse. Chaque élève reçoit un identifiant et un code de connexion, même sans e-mail ni téléphone.",
    tone: "orchid",
    icon: UsersThreeIcon,
  },
  {
    title: "Les parents, si vous le souhaitez.",
    text: "Vous pouvez créer un compte pour les parents de vos élèves et échanger avec eux dans la messagerie.",
    tone: "emerald",
    icon: ChatsCircleIcon,
  },
] as const;

/** La mise en place de l'espace d'un prof particulier, avant la première semaine. */
export function TeacherSetup() {
  return (
    <section
      id="mise-en-place"
      aria-labelledby="setup-title"
      className="relative scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-14 sm:gap-16">
        <SectionHeading
          id="setup-title"
          eyebrow="Votre espace prof"
          title={[
            "Vos groupes, vos élèves,",
            <Fragment key="l2">
              <span className="text-brand-active dark:text-brand">
                sans passer par une école.
              </span>
            </Fragment>,
          ]}
          sub="Vous mettez en place votre espace vous-même, puis vous donnez vos devoirs depuis la banque d'exercices."
        />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Frame className="h-full">
                <div className="flex h-full flex-col gap-4 p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <GlowIcon tone={step.tone} icon={step.icon} size={44} />
                    <span className="font-mono text-[12px] font-medium text-foreground/45 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-[19px] leading-tight font-semibold tracking-[-0.015em] text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-foreground/75">
                    {step.text}
                  </p>
                </div>
              </Frame>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
