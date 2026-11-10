import { TsfEyebrow } from "@wema/ui/brand";
import { CARD_INNER_SHADOW, CardShell } from "@wema/ui/components/ui/card";
import { cn } from "@wema/ui/lib/utils";
import type { ReactNode } from "react";

/** Une section de la vitrine : sur-titre tapé, titre, quand s'en servir. */
export function Section({
  id,
  index,
  title,
  when,
  children,
}: {
  id: string;
  index: number;
  title: string;
  /** Une ligne : quand utiliser ces composants. */
  when: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-32 flex-col lg:scroll-mt-20 gap-8 border-t pt-12 first:border-t-0 first:pt-0"
    >
      <header className="flex max-w-3xl flex-col gap-3">
        <TsfEyebrow
          phrases={[`${String(index).padStart(2, "0")} · ${title}`]}
          rule={false}
        />
        <h2
          id={`${id}-title`}
          className="text-3xl font-light tracking-tight sm:text-4xl"
        >
          {title}
        </h2>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {when}
        </p>
      </header>
      {children}
    </section>
  );
}

/** Un spécimen : étiquette mono, note facultative, le composant en direct. */
export function Specimen({
  label,
  note,
  children,
  className,
  bare = false,
}: {
  label: string;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Sans cadre (le composant a déjà le sien). */
  bare?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-mono text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </h3>
        {note ? (
          <div className="text-xs text-muted-foreground">{note}</div>
        ) : null}
      </div>
      {bare ? (
        <div className={cn("min-w-0", className)}>{children}</div>
      ) : (
        <CardShell>
          <div
            className={cn(
              "min-w-0 flex-1 rounded-card border bg-card p-4 sm:p-6",
              CARD_INNER_SHADOW,
              className,
            )}
          >
            {children}
          </div>
        </CardShell>
      )}
    </div>
  );
}

/** Section dont le module n'est pas encore livré. */
export function Pending({ what }: { what: string }) {
  return (
    <div className="rounded-card border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
      {what} : en cours de construction, la section apparaîtra ici dès que le
      module sera livré.
    </div>
  );
}
