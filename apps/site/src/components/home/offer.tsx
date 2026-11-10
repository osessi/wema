"use client";

import type { ComponentProps } from "react";
import { appLinks, PRICE_FROM_PER_SUBJECT_MONTHLY } from "../../lib/site";
import { GlowIcon } from "../../wa/components/v2/glow-icon";
import { Frame, SectionHeading } from "../../wa/components/v2/primitives";
import { TsfCta, TsfLink } from "../../wa/components/v2/tsf/tsf-cta";
import { TsfDecode } from "../../wa/components/v2/tsf/tsf-decode";
import type { GlowTone } from "../../wa/ui/components/ui/glow-tile";
import { BooksIcon, CreditCardIcon, HandshakeIcon } from "../../wa/ui/icons";
import { cn } from "../../wa/ui/lib/utils";
import {
  CameraIcon,
  ChartIcon,
  ClassIcon,
  ExamIcon,
  MathIcon,
  ProfileIcon,
  VideoIcon,
} from "./icons";

/**
 * L'offre, sur le modèle de `wa/components/v2/pricing-section.tsx` et
 * `pricing/includes.tsx`. Aucun montant tant que le prix d'appel vaut `null`.
 */

type Include = {
  title: string;
  line: string;
  icon: ComponentProps<typeof GlowIcon>["icon"];
  tone: GlowTone;
};

type Plan = {
  id: string;
  name: string;
  badge?: string;
  headline: string;
  under: string;
  pitch: string;
  cta: { label: string; href: string };
  includesLabel: string;
  includes: readonly Include[];
  dark: boolean;
};

const PLANS: readonly Plan[] = [
  {
    id: "familles",
    name: "Familles",
    badge: "Pour commencer",
    headline: "Essai gratuit",
    under:
      PRICE_FROM_PER_SUBJECT_MONTHLY === null
        ? "puis un abonnement par matière, au prix de votre pays"
        : `puis à partir de ${PRICE_FROM_PER_SUBJECT_MONTHLY} par matière et par mois`,
    pitch:
      "L'essai se lance sans moyen de paiement. Ensuite, vous ne payez que les matières choisies. Le prix de votre pays est affiché dans l'application avant tout paiement.",
    cta: { label: "Commencer l'essai gratuit", href: appLinks.signup },
    includesLabel: "Chaque matière comprend",
    includes: [
      {
        title: "Le prof IA de la matière",
        line: "Sur le programme officiel de la classe, jamais la réponse.",
        icon: MathIcon,
        tone: "gold",
      },
      {
        title: "Le premier entretien offert",
        line: "Pour qu'il apprenne qui est l'élève avant de proposer quoi que ce soit.",
        icon: ProfileIcon,
        tone: "ember",
      },
      {
        title: "Des exercices adaptés",
        line: "Difficulté, indices, contexte et forme ajustés à l'élève.",
        icon: ExamIcon,
        tone: "emerald",
      },
      {
        title: "La relecture des copies",
        line: "Une photo du contrôle corrigé, les notions retravaillées.",
        icon: CameraIcon,
        tone: "crimson",
      },
      {
        title: "L'espace parent",
        line: "Maîtrise par notion, résumé de la semaine, données exportables.",
        icon: ChartIcon,
        tone: "indigo",
      },
    ],
    dark: true,
  },
  {
    id: "ecoles",
    name: "Écoles et réseaux",
    headline: "Sur contrat",
    under: "selon le nombre de classes et de matières",
    pitch:
      "Pour un établissement ou un réseau d'écoles : comptes, classes et rôles gérés par vous, facturation sur contrat.",
    cta: { label: "Parler d'un contrat", href: "/contact" },
    includesLabel: "Le contrat comprend",
    includes: [
      {
        title: "Classes, profs et rôles",
        line: "Direction, profs, élèves et parents, chacun avec ses accès.",
        icon: ClassIcon,
        tone: "emerald",
      },
      {
        title: "La banque de la semaine",
        line: "Des exercices sur le programme, chaque lundi, à choisir ou compléter.",
        icon: BooksIcon,
        tone: "gold",
      },
      {
        title: "Le suivi de classe",
        line: "Les notions à reprendre, classe par classe.",
        icon: ChartIcon,
        tone: "indigo",
      },
      {
        title: "Agenda et visio",
        line: "Les séances planifiées et tenues au même endroit.",
        icon: VideoIcon,
        tone: "orchid",
      },
      {
        title: "Une facturation sur contrat",
        line: "Un seul interlocuteur pour l'établissement.",
        icon: HandshakeIcon,
        tone: "ember",
      },
    ],
    dark: false,
  },
];

function IncludeList({ items }: { items: readonly Include[] }) {
  return (
    <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
      {items.map((item, index) => (
        <li
          key={item.title}
          className="flex items-start gap-4 border-t border-current/10 py-4 first:border-t-0 sm:[&:nth-child(2)]:border-t-0"
        >
          <GlowIcon
            tone={item.tone}
            icon={item.icon}
            size={44}
            className="shrink-0"
          />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-medium tabular-nums opacity-45">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-[17px] font-semibold tracking-[-0.01em]">
                {item.title}
              </span>
            </span>
            <span className="text-[15px] leading-snug opacity-75">
              {item.line}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const { dark } = plan;
  return (
    <Frame tone={dark ? "graphite" : "surface"} innerClassName="relative">
      {dark ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_0%_0%,rgb(255_197_41/0.32),transparent_70%)]"
        />
      ) : null}
      <div
        className={cn(
          "relative grid lg:grid-cols-[0.9fr_1.1fr]",
          dark ? "text-[#F5F6F0]" : "text-foreground",
        )}
        {...(dark ? { "data-theme": "dark" } : {})}
      >
        <div className="flex flex-col gap-8 border-b border-current/10 p-7 sm:p-10 lg:border-r lg:border-b-0 lg:p-12">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center bg-[#151610] [clip-path:polygon(8px_0,100%_0,100%_calc(100%-8px),calc(100%-8px)_100%,0_100%,0_8px)]">
                <span
                  aria-hidden="true"
                  className="font-display text-[20px] font-bold text-brand"
                >
                  W
                </span>
              </span>
              <h3 className="text-[22px] font-normal tracking-[-0.03em]">
                {plan.name}
              </h3>
              {plan.badge === undefined ? null : (
                <TsfDecode
                  text={plan.badge}
                  className="ml-auto text-[12px] font-medium tracking-[0.08em] text-brand uppercase"
                />
              )}
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-[48px] leading-none font-light tracking-[-0.04em] sm:text-[60px]">
                {plan.headline}
              </p>
              <p className="text-[17px] font-medium opacity-75">{plan.under}</p>
            </div>
            <p className="max-w-[400px] text-[16px] leading-relaxed opacity-75">
              {plan.pitch}
            </p>
          </div>
          <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-center">
            <TsfCta href={plan.cta.href} tone={dark ? "accent" : "ink"}>
              {plan.cta.label}
            </TsfCta>
          </div>
        </div>

        <div className="p-7 sm:p-10 lg:p-12">
          <TsfDecode
            text={plan.includesLabel}
            className="text-[12px] font-medium tracking-[0.08em] uppercase opacity-60"
          />
          <IncludeList items={plan.includes} />
        </div>
      </div>
    </Frame>
  );
}

export function Offer() {
  return (
    <section
      id="offre"
      aria-labelledby="offre-title"
      className="relative scroll-mt-28 px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <SectionHeading
          id="offre-title"
          eyebrow="L'offre"
          title={[
            "Un abonnement par matière,",
            <span key="l2" className="text-brand-active dark:text-brand">
              après un essai gratuit.
            </span>,
          ]}
          sub="Vous commencez sans moyen de paiement. Vous ajoutez une matière quand elle vous sert, vous l'arrêtez quand elle ne sert plus."
        />

        <div className="mt-14 flex flex-col gap-8 lg:mt-16">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-3">
            <GlowIcon tone="gold" icon={CreditCardIcon} size={40} />
            <p className="text-[16px] font-medium text-foreground">
              Paiement par carte ou Mobile Money
            </p>
          </div>
          <p className="text-[15px] font-medium text-foreground/70">
            Le prix de votre pays s'affiche avant tout paiement.{" "}
            <TsfLink href={appLinks.terms} className="font-medium">
              Conditions
            </TsfLink>
          </p>
        </div>
      </div>
    </section>
  );
}
