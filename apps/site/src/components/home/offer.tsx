import type { Icon } from "@phosphor-icons/react";
import {
  Camera,
  ChatsCircle,
  Eye,
  Handshake,
  Shapes,
  UserFocus,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { appLinks, PRICE_FROM_PER_SUBJECT_MONTHLY } from "../../lib/site";
import { Frame, GlowTile, Mono, SectionHead, SlantButton } from "../kit";

const INCLUDED: readonly {
  icon: Icon;
  tone: string;
  title: string;
  text: string;
}[] = [
  {
    icon: ChatsCircle,
    tone: "#ffc529",
    title: "Le prof IA de la matière",
    text: "Disponible à toute heure, il guide sans donner la réponse.",
  },
  {
    icon: UserFocus,
    tone: "#ffe89a",
    title: "Premier entretien offert",
    text: "Il fait connaissance avec l'élève avant de commencer.",
  },
  {
    icon: Shapes,
    tone: "#bfefd9",
    title: "Exercices adaptés",
    text: "Difficulté, indices et forme ajustés à chaque exercice.",
  },
  {
    icon: Camera,
    tone: "#f7c6d9",
    title: "Relecture des copies",
    text: "Une photo du contrôle, et il fait retravailler les erreurs.",
  },
  {
    icon: Eye,
    tone: "#ead9bf",
    title: "Espace parent",
    text: "Progrès, temps de travail et points à revoir.",
  },
];

export function Offer() {
  const price = PRICE_FROM_PER_SUBJECT_MONTHLY;
  return (
    <section id="offre" className="relative px-4 py-24 sm:py-32">
      <SectionHead
        eyebrow="L'offre"
        lead="Vous ne payez que"
        follow="les matières dont il a besoin."
        text="Un abonnement par matière, après un essai gratuit qui ne demande aucun moyen de paiement. Le prix de votre pays est affiché avant tout paiement."
      />

      <div className="mx-auto mt-14 max-w-6xl space-y-4">
        <Frame cut={20} className="bg-surface">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col border-b border-line p-6 sm:p-10 lg:border-r lg:border-b-0">
              <div className="flex items-center gap-3">
                <GlowTile tone="#ffc529" size={36} className="rounded-[10px]">
                  <span className="font-display text-base font-bold">W</span>
                </GlowTile>
                <span className="text-[17px] font-semibold">Familles</span>
              </div>
              <p className="mt-8 font-display text-[clamp(2.8rem,6vw,4.4rem)] leading-none font-light tracking-[-0.04em]">
                {price ?? "Essai gratuit"}
              </p>
              <p className="mt-3 text-[16px] text-ink-muted">
                {price
                  ? "par matière et par mois, après l'essai gratuit."
                  : "puis un abonnement par matière, au prix de votre pays."}
              </p>
              <div className="mt-10 lg:mt-auto lg:pt-10">
                <SlantButton href={appLinks.signup}>
                  Commencer l'essai gratuit
                </SlantButton>
                <Mono className="mt-4 block text-ink-muted">
                  Carte bancaire ou Mobile Money, au moment de s'abonner.
                </Mono>
              </div>
            </div>
            <div className="p-6 sm:p-10">
              <Mono className="text-ink-muted uppercase">
                Chaque matière comprend
              </Mono>
              <ul className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                {INCLUDED.map((item, i) => {
                  const ItemIcon = item.icon;
                  return (
                    <li
                      key={item.title}
                      className="flex gap-3 border-t border-line pt-4"
                    >
                      <GlowTile
                        tone={item.tone}
                        size={34}
                        className="rounded-[9px]"
                      >
                        <ItemIcon size={17} weight="bold" />
                      </GlowTile>
                      <span>
                        <span className="text-[15px] font-semibold">
                          <Mono className="mr-1.5 text-ink-muted">
                            {String(i + 1).padStart(2, "0")}
                          </Mono>
                          {item.title}
                        </span>
                        <span className="mt-1 block text-[14px] leading-snug text-ink-muted">
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

        <Frame
          cut={20}
          edge="rgb(255 255 255 / 0.1)"
          className="on-dark hero-field text-[#f4f1e6]"
        >
          <div className="relative flex flex-col gap-6 p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <GlowTile tone="#ffc529" size={40} className="rounded-[10px]">
                <Handshake size={20} weight="bold" />
              </GlowTile>
              <div>
                <h3 className="text-[19px] font-semibold">Écoles et réseaux</h3>
                <p className="mt-1.5 max-w-[52ch] text-[15px] leading-relaxed text-white/75">
                  Sur contrat : vos élèves ont accès aux matières ouvertes, sans
                  abonnement individuel. Classes, profs et suivi inclus.
                </p>
              </div>
            </div>
            <Link
              href="/profs-et-ecoles"
              className="notch-btn shrink-0 self-start lg:self-center"
            >
              Voir l'offre écoles
            </Link>
          </div>
        </Frame>
      </div>
    </section>
  );
}
