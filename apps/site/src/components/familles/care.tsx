import type { Icon } from "@phosphor-icons/react";
import {
  DownloadSimple,
  LockKey,
  ProhibitInset,
  ShieldCheck,
  Trash,
  UserCheck,
} from "@phosphor-icons/react/ssr";
import { appLinks } from "../../lib/site";
import { Frame, SectionHeading } from "../../wa/components/v2/primitives";
import { TsfLink } from "../../wa/components/v2/tsf/tsf-cta";
import { GlowTile, type GlowTone } from "../../wa/ui/components/ui/glow-tile";

const FORMATS = [
  "Lecture facile",
  "Schémas",
  "Audio",
  "Bande dessinée",
  "Manipulables",
] as const;

const NEEDS_RULES = [
  {
    who: "Qui déclare",
    what: "Vous, ou son prof avec votre accord.",
  },
  {
    who: "Ce que fait l'IA",
    what: "Elle adapte la forme des exercices et sa façon d'expliquer.",
  },
  {
    who: "Ce qu'elle ne fait jamais",
    what: "Poser un diagnostic, ou chercher à repérer un trouble.",
  },
] as const;

const DATA: readonly {
  icon: Icon;
  tone: GlowTone;
  title: string;
  text: string;
}[] = [
  {
    icon: UserCheck,
    tone: "gold",
    title: "Votre consentement d'abord",
    text: "Le compte de votre enfant est rattaché au vôtre. Les choix qui le concernent passent par vous.",
  },
  {
    icon: LockKey,
    tone: "indigo",
    title: "Besoins de santé chiffrés",
    text: "Stockés à part, visibles des seules personnes autorisées, partagés avec une autre structure seulement si vous le décidez.",
  },
  {
    icon: DownloadSimple,
    tone: "emerald",
    title: "Export à tout moment",
    text: "Vous récupérez les données de votre enfant depuis l'application.",
  },
  {
    icon: Trash,
    tone: "crimson",
    title: "Suppression sur demande",
    text: "Vous demandez leur suppression depuis votre espace parent.",
  },
  {
    icon: ProhibitInset,
    tone: "orchid",
    title: "Sans publicité",
    text: "Ni pour l'élève, ni pour vous. L'abonnement paie le service.",
  },
];

export function Care() {
  return (
    <section
      id="besoins-et-donnees"
      aria-labelledby="care-title"
      className="relative scroll-mt-28 px-4 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-14 sm:gap-16">
        <SectionHeading
          id="care-title"
          eyebrow="Besoins particuliers et données"
          title={[
            "Adapté à votre enfant,",
            <span key="l2" className="text-brand-active dark:text-brand">
              protégé par défaut.
            </span>,
          ]}
          sub="Un besoin dys ou TDAH se déclare, il ne se devine pas. Et les données d'un mineur se traitent avec plus de soin que les autres."
        />

        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          <Frame tone="graphite" innerClassName="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_0%_0%,rgb(228_107_255/0.22),transparent_70%)]"
            />
            <div className="relative flex h-full flex-col gap-7 p-6 sm:p-10">
              <div className="flex items-center gap-3">
                <GlowTile tone="orchid" size={44}>
                  <ShieldCheck size={21} weight="bold" />
                </GlowTile>
                <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-[#F5F6F0]/60 uppercase">
                  Dys, TDAH
                </span>
              </div>
              <h3 className="text-balance text-[28px] leading-[1.08] font-light tracking-[-0.035em] text-[#F5F6F0] sm:text-[36px]">
                L'IA adapte.{" "}
                <span className="text-[#ffc529]">
                  Elle ne diagnostique pas.
                </span>
              </h3>
              <dl className="flex flex-col">
                {NEEDS_RULES.map((rule) => (
                  <div
                    key={rule.who}
                    className="grid gap-1 border-t border-white/10 py-3.5 sm:grid-cols-[170px_1fr] sm:gap-4"
                  >
                    <dt className="font-mono text-[11px] font-medium tracking-[0.08em] text-[#F5F6F0]/55 uppercase sm:pt-0.5">
                      {rule.who}
                    </dt>
                    <dd className="text-[16px] leading-relaxed text-[#F5F6F0]/85">
                      {rule.what}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-auto flex flex-col gap-3">
                <span className="font-mono text-[11px] font-medium tracking-[0.08em] text-[#F5F6F0]/55 uppercase">
                  Formats possibles
                </span>
                <ul className="flex flex-wrap gap-1.5">
                  {FORMATS.map((f) => (
                    <li
                      key={f}
                      className="rounded-full border border-white/15 px-2.5 py-1 text-[13px] font-medium text-[#F5F6F0]/85"
                    >
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Frame>

          <Frame innerClassName="flex h-full flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-foreground/10 px-6 py-4 sm:px-10">
              <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-foreground/60 uppercase">
                Les données de votre enfant
              </span>
              <span className="font-mono text-[12px] font-medium text-foreground/60 tabular-nums">
                {String(DATA.length).padStart(2, "0")}
              </span>
            </div>
            <ul className="flex flex-col px-6 sm:px-10">
              {DATA.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <li
                    key={item.title}
                    className="flex gap-4 border-b border-foreground/10 py-4 last:border-b-0"
                  >
                    <GlowTile tone={item.tone} size={36} className="shrink-0">
                      <ItemIcon size={17} weight="bold" />
                    </GlowTile>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[16.5px] font-semibold tracking-[-0.01em] text-foreground">
                        {item.title}
                      </span>
                      <span className="text-[15px] leading-relaxed text-foreground/72">
                        {item.text}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-auto border-t border-foreground/10 px-6 py-5 sm:px-10">
              <TsfLink
                href={appLinks.privacy}
                className="text-[15px] font-medium"
              >
                Lire la politique de confidentialité
              </TsfLink>
            </div>
          </Frame>
        </div>
      </div>
    </section>
  );
}
