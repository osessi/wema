import type { Icon } from "@phosphor-icons/react";
import {
  Camera,
  ChatsCircle,
  CreditCard,
  Eye,
  Shapes,
  SignOut,
  UserFocus,
} from "@phosphor-icons/react/ssr";
import { PRICE_FROM_PER_SUBJECT_MONTHLY } from "../../lib/site";
import { Frame, SectionHeading } from "../../wa/components/v2/primitives";
import { TsfCta } from "../../wa/components/v2/tsf/tsf-cta";
import { TsfDecode } from "../../wa/components/v2/tsf/tsf-decode";
import { signupHref } from "../../wa/config/site";
import { GlowTile, type GlowTone } from "../../wa/ui/components/ui/glow-tile";

const INCLUDED: readonly {
  icon: Icon;
  tone: GlowTone;
  title: string;
  text: string;
}[] = [
  {
    icon: ChatsCircle,
    tone: "gold",
    title: "Le prof IA de la matière",
    text: "Disponible à toute heure. Il guide sans donner la réponse.",
  },
  {
    icon: UserFocus,
    tone: "ember",
    title: "Premier entretien offert",
    text: "Il fait connaissance avec votre enfant avant de commencer.",
  },
  {
    icon: Shapes,
    tone: "emerald",
    title: "Des exercices faits pour lui",
    text: "Difficulté, indices, contexte et forme ajustés à chaque exercice.",
  },
  {
    icon: Camera,
    tone: "crimson",
    title: "Sa copie relue",
    text: "Une photo du devoir corrigé, et il retravaille ses erreurs.",
  },
  {
    icon: Eye,
    tone: "indigo",
    title: "L'espace parent",
    text: "Maîtrise par notion, temps de travail, points à revoir.",
  },
];

const TERMS: readonly { icon: Icon; title: string; text: string }[] = [
  {
    icon: CreditCard,
    title: "Carte ou Mobile Money",
    text: "Selon les moyens proposés dans votre pays, au moment de vous abonner.",
  },
  {
    icon: SignOut,
    title: "Résiliation matière par matière",
    text: "Depuis votre espace parent. L'accès reste ouvert jusqu'à la fin de la période payée.",
  },
];

export function FamilyOffer() {
  const price = PRICE_FROM_PER_SUBJECT_MONTHLY;
  return (
    <section
      id="offre"
      aria-labelledby="offer-title"
      className="relative scroll-mt-28 px-4 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <SectionHeading
          id="offer-title"
          eyebrow="L'offre famille"
          title={[
            "Vous ne payez que",
            <span key="l2" className="text-brand-active dark:text-brand">
              les matières où il en a besoin.
            </span>,
          ]}
          sub="Un abonnement par matière, après un essai gratuit qui ne demande aucun moyen de paiement. Le prix de votre pays est affiché dans l'application avant tout paiement."
        />

        <Frame
          tone="graphite"
          className="mt-14 sm:mt-16"
          innerClassName="relative"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_0%_0%,rgb(255_197_41/0.3),transparent_70%)]"
          />
          <div className="relative grid text-[#F5F6F0] lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col gap-8 border-b border-white/10 p-7 sm:p-10 lg:border-r lg:border-b-0 lg:p-12">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center bg-[#ffc529] [clip-path:polygon(8px_0,100%_0,100%_calc(100%-8px),calc(100%-8px)_100%,0_100%,0_8px)]">
                  <span className="text-[18px] font-bold text-[#1a1403]">
                    W
                  </span>
                </span>
                <span className="text-[22px] font-normal tracking-[-0.03em]">
                  Familles
                </span>
                <TsfDecode
                  text="Par matière"
                  className="ml-auto text-[12px] font-medium tracking-[0.08em] text-[#ffc529] uppercase"
                />
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-[52px] leading-none font-light tracking-[-0.04em] sm:text-[64px]">
                  {price ?? "Essai gratuit"}
                </p>
                <p className="text-[17px] text-[#F5F6F0]/75">
                  {price === null
                    ? "puis un abonnement par matière, au prix de votre pays."
                    : "par matière et par mois, après l'essai gratuit."}
                </p>
              </div>
              <ul className="flex flex-col gap-2 text-[15.5px] text-[#F5F6F0]/85">
                {[
                  "Un essai gratuit par enfant et par matière",
                  "Aucun moyen de paiement pour l'essai",
                  "Premier entretien toujours offert",
                ].map((line) => (
                  <li key={line} className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="size-[6px] shrink-0 rotate-45 bg-[#ffc529]"
                    />
                    {line}
                  </li>
                ))}
              </ul>
              <div className="lg:mt-auto">
                <TsfCta href={signupHref} tone="accent">
                  Commencer l'essai gratuit
                </TsfCta>
              </div>
            </div>

            <div className="flex flex-col p-7 sm:p-10 lg:p-12">
              <TsfDecode
                text="Chaque matière comprend"
                className="text-[12px] font-medium tracking-[0.08em] uppercase opacity-60"
              />
              <ul className="mt-4 flex flex-col">
                {INCLUDED.map((item, index) => {
                  const ItemIcon = item.icon;
                  return (
                    <li
                      key={item.title}
                      className="flex items-start gap-4 border-t border-white/10 py-3.5 first:border-t-0"
                    >
                      <GlowTile tone={item.tone} size={38} className="shrink-0">
                        <ItemIcon size={18} weight="bold" />
                      </GlowTile>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[16.5px] font-semibold tracking-[-0.01em]">
                          <span className="mr-2 font-mono text-[11px] font-medium text-[#F5F6F0]/45 tabular-nums">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {item.title}
                        </span>
                        <span className="text-[15px] leading-snug text-[#F5F6F0]/70">
                          {item.text}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </Frame>

        <ul className="mt-5 grid gap-5 md:grid-cols-2">
          {TERMS.map((term) => {
            const TermIcon = term.icon;
            return (
              <li key={term.title}>
                <Frame innerClassName="flex items-start gap-4 p-6 sm:p-7">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-foreground/15 text-foreground">
                    <TermIcon size={20} weight="bold" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">
                      {term.title}
                    </span>
                    <span className="text-[15px] leading-relaxed text-foreground/72">
                      {term.text}
                    </span>
                  </span>
                </Frame>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
