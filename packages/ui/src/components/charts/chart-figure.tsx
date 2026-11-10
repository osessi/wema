/**
 * Cadre accessible commun à tous les graphiques : un `<figure>` nommé par
 * `aria-label`, le dessin masqué aux lecteurs d'écran, et à la place un
 * résumé texte (`summary`) ou, à défaut, un tableau des données masqué
 * visuellement.
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { TONE_CSS } from "./palette";

export interface ChartTable {
  readonly head: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export function ChartFigure({
  label,
  summary,
  table,
  className,
  children,
}: {
  label: string;
  summary?: string | undefined;
  table: ChartTable;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <figure
      aria-label={label}
      data-chart-tones=""
      className={cn("relative m-0 min-w-0", className)}
    >
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: constante du code, pas une saisie. */}
      <style dangerouslySetInnerHTML={{ __html: TONE_CSS }} />
      <div aria-hidden>{children}</div>
      {summary ? (
        <figcaption className="sr-only">{summary}</figcaption>
      ) : (
        <table className="sr-only">
          <caption>{label}</caption>
          <thead>
            <tr>
              {table.head.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.join("|")}>
                {row.map((cell, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: colonnes positionnelles
                  <td key={i}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}

/** Tableau d'un graphique à séries : une ligne par donnée. */
export function seriesTable(
  data: readonly Readonly<Record<string, unknown>>[],
  x: string,
  xLabel: string,
  series: readonly { key: string; label: string }[],
  format: (value: number) => string,
): ChartTable {
  return {
    head: [xLabel, ...series.map((s) => s.label)],
    rows: data.map((d) => [
      String(d[x] ?? ""),
      ...series.map((s) => {
        const v = d[s.key];
        return typeof v === "number" ? format(v) : "";
      }),
    ]),
  };
}
