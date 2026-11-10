import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import {
  NOTION_STATUS_GLYPHS,
  NOTION_STATUS_LABELS,
  NOTION_STATUS_TONES,
  type NotionStatusKey,
  NotionStatusLegend,
} from "./notion-status";

export interface HeatmapNotion {
  id: string;
  name: string;
}

export interface HeatmapLearner {
  id: string;
  name: string;
  /** Statut par identifiant de notion ; une notion absente vaut « Non vue ». */
  statuses: Partial<Record<string, NotionStatusKey>>;
  /** Lien vers la fiche de l'élève. */
  href?: string | undefined;
}

export interface NotionHeatmapProps {
  /** Légende du tableau (lue par les lecteurs d'écran). */
  caption: string;
  notions: HeatmapNotion[];
  learners: HeatmapLearner[];
  /** En-tête de la colonne des élèves. */
  learnerHeader?: string | undefined;
  statusLabels?: Partial<Record<NotionStatusKey, string>> | undefined;
  /** Rendu d'un lien (le `Link` de Next) ; `<a>` par défaut. */
  renderLink?:
    | ((props: {
        href: string;
        className: string;
        children: ReactNode;
      }) => ReactNode)
    | undefined;
  /** Affiche la légende sous la grille. */
  legend?: boolean | undefined;
  className?: string | undefined;
}

/**
 * Grille élèves × notions (logique du `Grid` de `teacher/class-map.tsx`) :
 * une case colorée par statut, le libellé dans l'info-bulle et pour les
 * lecteurs d'écran. Elle défile horizontalement dans son propre cadre ; la
 * colonne des élèves reste collée à gauche. La page ne déborde jamais.
 */
export function NotionHeatmap({
  caption,
  notions,
  learners,
  learnerHeader = "Élève",
  statusLabels,
  renderLink,
  legend = true,
  className,
}: NotionHeatmapProps) {
  const label = (s: NotionStatusKey) =>
    statusLabels?.[s] ?? NOTION_STATUS_LABELS[s];
  const link =
    renderLink ??
    ((p: { href: string; className: string; children: ReactNode }) => (
      <a href={p.href} className={p.className}>
        {p.children}
      </a>
    ));
  return (
    <div
      data-slot="notion-heatmap"
      className={cn("min-w-0 space-y-3", className)}
    >
      <div className="relative max-w-full overflow-x-auto overscroll-x-contain rounded-card border bg-card">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 border-b bg-card px-3 py-2 text-left align-bottom font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
              >
                {learnerHeader}
              </th>
              {notions.map((n) => (
                <th
                  key={n.id}
                  scope="col"
                  title={n.name}
                  className="h-28 w-10 min-w-10 border-b px-1 pb-2 align-bottom font-normal"
                >
                  <span className="mx-auto block max-h-24 overflow-hidden text-left text-xs text-ellipsis whitespace-nowrap text-muted-foreground [writing-mode:vertical-rl] rotate-180">
                    {n.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {learners.map((l) => (
              <tr key={l.id} className="group">
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-44 truncate border-b bg-card px-3 py-1.5 text-left font-medium group-last:border-b-0 group-hover:bg-muted"
                >
                  {l.href
                    ? link({
                        href: l.href,
                        className:
                          "rounded-chip outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring",
                        children: l.name,
                      })
                    : l.name}
                </th>
                {notions.map((n) => {
                  const s = l.statuses[n.id] ?? "not_seen";
                  return (
                    <td
                      key={n.id}
                      className="border-b p-1 text-center group-last:border-b-0 group-hover:bg-muted/50"
                    >
                      <span
                        title={`${n.name} : ${label(s)}`}
                        className={cn(
                          "mx-auto grid size-7 place-items-center rounded-chip border border-foreground/5",
                          NOTION_STATUS_TONES[s].cell,
                          NOTION_STATUS_TONES[s].glyph,
                        )}
                      >
                        <span aria-hidden>{NOTION_STATUS_GLYPHS[s]}</span>
                        <span className="sr-only">{label(s)}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {legend ? <NotionStatusLegend labels={statusLabels} /> : null}
    </div>
  );
}
