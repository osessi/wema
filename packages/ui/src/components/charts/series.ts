/**
 * Séries et nombres.
 *
 * - `Series` : `{ key, label, tone? }` ; `key` est une clé de chaque donnée,
 *   `label` le nom affiché, `tone` un ton de la palette (sinon l'ordre par défaut).
 * - `Datum` : une ligne de données (`{ semaine: "S1", maitrise: 42 }`).
 * - `formatNumber`, `compactNumber` : nombres en `fr-FR`.
 */
import type { ChartConfig } from "../ui/chart";
import { type ChartTone, toneAt, toneColor } from "./palette";

export interface Series {
  readonly key: string;
  readonly label: string;
  readonly tone?: ChartTone | undefined;
}

export type Datum = Readonly<
  Record<string, string | number | null | undefined>
>;

export type ValueFormatter = (value: number) => string;

export function toConfig(series: readonly Series[]): ChartConfig {
  const config: ChartConfig = {};
  series.forEach((s, i) => {
    config[s.key] = { label: s.label, color: toneColor(s.tone ?? toneAt(i)) };
  });
  return config;
}

const plain = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatNumber: ValueFormatter = (value) => plain.format(value);
export const compactNumber: ValueFormatter = (value) => compact.format(value);
