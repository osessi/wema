import type { ReactNode } from "react";

/** En-tête d'une page intérieure : titre, chapeau, et éventuellement l'action. */
export function PageIntro({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children?: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-12 pb-14 sm:px-6 md:pt-20 md:pb-20">
      <h1 className="max-w-3xl text-[2.5rem] leading-[1.05] font-bold sm:text-6xl">
        {title}
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
        {lead}
      </p>
      {children ? <div className="mt-8">{children}</div> : null}
    </section>
  );
}

/** Une liste de points : titre court, explication. */
export function FeatureList({
  items,
}: {
  items: readonly { title: string; text: string }[];
}) {
  return (
    <dl className="grid gap-x-12 gap-y-10 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.title} className="border-t border-line-strong pt-5">
          <dt className="font-display text-xl font-bold">{item.title}</dt>
          <dd className="mt-2 max-w-prose leading-relaxed text-muted-foreground">
            {item.text}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Section({
  title,
  lead,
  tone = "ground",
  children,
}: {
  title: string;
  lead?: string;
  tone?: "ground" | "surface";
  children: ReactNode;
}) {
  return (
    <section
      className={`border-t border-line ${tone === "surface" ? "bg-surface" : ""}`}
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">{title}</h2>
        {lead ? (
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {lead}
          </p>
        ) : null}
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}
