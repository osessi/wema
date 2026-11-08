import {
  ChalkboardTeacher,
  Key,
  Stethoscope,
} from "@phosphor-icons/react/dist/ssr";
import { Fragment } from "react";
import { Frame, SectionHeading } from "../../wa/components/v2/primitives";
import { GlowTile, type GlowTone } from "../../wa/ui/components/ui/glow-tile";

const LIMITS: readonly {
  readonly no: string;
  readonly text: string;
  readonly instead: string;
  readonly tone: GlowTone;
  readonly Icon: typeof Key;
}[] = [
  {
    no: "Il ne remplace pas le prof.",
    text: "Wema propose ; vous choisissez ce qui est donné, à qui et quand. Le prof IA prolonge votre travail entre les séances, il ne décide pas à votre place.",
    instead: "Vous gardez la main sur chaque exercice",
    tone: "gold",
    Icon: ChalkboardTeacher,
  },
  {
    no: "Il ne donne pas la réponse.",
    text: "Ni d'un exercice, ni d'un devoir. Le prof IA questionne, propose des indices de plus en plus précis et demande à l'élève d'expliquer son raisonnement.",
    instead: "L'élève trouve, et vous voyez comment",
    tone: "ember",
    Icon: Key,
  },
  {
    no: "Il ne pose pas de diagnostic.",
    text: "Un besoin de type dys ou TDAH est déclaré par le parent, ou par vous avec son accord. L'IA adapte sa façon d'enseigner ; elle ne cherche jamais à repérer un trouble.",
    instead: "Visible seulement si la famille le partage",
    tone: "crimson",
    Icon: Stethoscope,
  },
];

export function Limits() {
  return (
    <section
      aria-labelledby="limits-title"
      className="relative px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-14 sm:gap-16">
        <SectionHeading
          id="limits-title"
          eyebrow="Ce que Wema ne fait pas"
          title={[
            "Trois limites,",
            <Fragment key="l2">
              <span className="text-brand-active dark:text-brand">
                qui ne se règlent pas.
              </span>
            </Fragment>,
          ]}
          sub="Elles font partie des règles du produit, pour chaque élève et chaque matière."
        />
        <ul className="grid gap-5 md:grid-cols-3">
          {LIMITS.map((item, i) => (
            <li key={item.no}>
              <Frame className="h-full">
                <div className="flex h-full flex-col gap-5 p-6 sm:p-7">
                  <div className="flex items-center justify-between">
                    <span className="relative">
                      <GlowTile tone={item.tone} size={48}>
                        <item.Icon size={22} weight="bold" />
                      </GlowTile>
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-1/2 h-[2px] w-[62px] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-foreground/80"
                      />
                    </span>
                    <span className="font-mono text-[12px] font-medium text-foreground/45 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-[24px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance text-foreground">
                    {item.no}
                  </h3>
                  <p className="text-[16px] leading-relaxed text-foreground/75">
                    {item.text}
                  </p>
                  <p className="mt-auto flex items-center gap-2.5 border-t border-foreground/10 pt-4 font-mono text-[12px] font-medium tracking-[0.04em] text-foreground/70 uppercase">
                    <span
                      aria-hidden="true"
                      className="size-[7px] shrink-0 rotate-45 bg-brand"
                    />
                    {item.instead}
                  </p>
                </div>
              </Frame>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
