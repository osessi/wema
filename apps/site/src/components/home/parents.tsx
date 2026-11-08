import {
  HandHeart,
  LockKey,
  ProhibitInset,
  ShieldCheck,
} from "@phosphor-icons/react/ssr";
import { cx, Frame, Mono, SectionHead } from "../kit";

/** Carte de maîtrise : une case par notion, plus foncée quand elle est acquise. */
const NOTIONS = [
  { name: "Fractions", level: 3 },
  { name: "Priorités", level: 3 },
  { name: "Puissances", level: 2 },
  { name: "Équations", level: 2 },
  { name: "Aire", level: 1 },
  { name: "Périmètre", level: 2 },
  { name: "Pythagore", level: 0 },
  { name: "Proportions", level: 1 },
] as const;

const LEVEL = [
  {
    label: "Pas encore vu",
    cls: "bg-white/[0.04] text-white/45 border-white/10",
  },
  { label: "En cours", cls: "bg-brand/15 text-brand border-brand/30" },
  { label: "Presque", cls: "bg-brand/40 text-white border-brand/50" },
  { label: "Acquis", cls: "bg-brand text-ink border-brand" },
] as const;

function Cell({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("border-graphite-line p-5 sm:p-7", className)}>
      <Mono className="text-graphite-muted uppercase">{title}</Mono>
      {children}
    </div>
  );
}

export function Parents() {
  return (
    <section id="parents" className="on-dark relative px-2 py-2 sm:px-3">
      <Frame
        cut={22}
        edge="rgb(255 255 255 / 0.1)"
        className="rounded-[20px] bg-graphite px-4 py-24 text-[#f4f1e6] sm:py-28"
      >
        <SectionHead
          tone="dark"
          eyebrow="Pour les parents"
          lead="Vous voyez ses progrès,"
          follow="pas seulement ses notes."
          text="Chaque semaine, vous savez ce qu'il a travaillé, ce qu'il a compris et ce qui coince encore. Avec les preuves, pas des impressions."
        />

        <div className="mx-auto mt-14 max-w-6xl border border-graphite-line">
          <div className="flex items-center justify-between border-b border-graphite-line px-5 py-3">
            <span className="text-[14px] font-semibold">
              Espace parent · Inès, 4e
            </span>
            <Mono className="flex items-center gap-1.5 text-graphite-muted uppercase">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-[#9fe3c4]"
              />
              Semaine en cours
            </Mono>
          </div>

          <div className="grid lg:grid-cols-2">
            <Cell
              title="Carte de maîtrise · Maths"
              className="border-b lg:border-r"
            >
              <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {NOTIONS.map((n) => (
                  <li
                    key={n.name}
                    className={cx(
                      "border px-2.5 py-3 text-[13px] font-semibold",
                      LEVEL[n.level].cls,
                    )}
                  >
                    {n.name}
                    <span className="mt-1 block font-mono text-[10px] font-normal opacity-80">
                      {LEVEL[n.level].label}
                    </span>
                  </li>
                ))}
              </ul>
            </Cell>

            <Cell title="Cette semaine" className="border-b">
              <dl className="mt-5 grid grid-cols-3 gap-px bg-graphite-line">
                {[
                  { k: "Travail", v: "2 h 40" },
                  { k: "Exercices", v: "23" },
                  { k: "Notions revues", v: "4" },
                ].map((s) => (
                  <div key={s.k} className="bg-graphite px-3 py-4">
                    <dt className="font-mono text-[10.5px] text-graphite-muted uppercase">
                      {s.k}
                    </dt>
                    <dd className="mt-1 font-display text-3xl font-light">
                      {s.v}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 border-l-2 border-brand pl-3 text-[14.5px] leading-relaxed text-white/85">
                « Inès confond encore aire et périmètre. Le prof IA lui propose
                des exercices avec schéma, le format où elle réussit le mieux. »
              </p>
            </Cell>
          </div>

          <ul className="grid sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: ProhibitInset,
                title: "Jamais la réponse",
                text: "Le prof IA ne fait pas les devoirs : il questionne et donne des indices.",
              },
              {
                icon: HandHeart,
                title: "Besoins respectés",
                text: "Un besoin dys ou TDAH se déclare par vous. L'IA adapte, elle ne diagnostique jamais.",
              },
              {
                icon: LockKey,
                title: "Données protégées",
                text: "Les besoins de santé sont chiffrés. Vous exportez ou supprimez ses données quand vous voulez.",
              },
              {
                icon: ShieldCheck,
                title: "Sans publicité",
                text: "Aucune publicité dans Wema, ni pour l'élève ni pour vous. L'abonnement paie le service.",
              },
            ].map((item, i) => {
              const ItemIcon = item.icon;
              return (
                <li
                  key={item.title}
                  className={cx(
                    "border-graphite-line p-5 sm:p-6",
                    i > 0 && "border-t sm:border-t-0",
                    i % 2 === 1 && "sm:border-l",
                    i >= 2 && "sm:border-t lg:border-t-0",
                    i === 2 && "lg:border-l",
                  )}
                >
                  <ItemIcon
                    size={22}
                    weight="duotone"
                    className="text-brand"
                    aria-hidden="true"
                  />
                  <h3 className="mt-3 text-[15px] font-semibold">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-graphite-muted">
                    {item.text}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </Frame>
    </section>
  );
}
