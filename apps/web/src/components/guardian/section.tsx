import type { ReactNode } from "react";

/** Bloc de la fiche enfant : titre, explication, contenu. */
export function Section({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="space-y-1">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {description && (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
