/**
 * Couleurs des graphiques de Wema.
 *
 * Le jaune de la marque porte la série principale ; les séries suivantes
 * prennent les tons des pastilles `GlowTile` (ambre, menthe, ciel, rose,
 * ardoise). En clair, les tons sont un peu plus profonds pour rester lisibles
 * sur fond blanc ; en sombre, ce sont les tons vifs des pastilles.
 *
 * - `ChartTone` : le nom d'un ton (mêmes noms que `GlowTone`).
 * - `TONE_ORDER` : l'ordre d'attribution par défaut des séries.
 * - `toneColor(tone)` : la variable CSS du ton, qui suit le thème.
 */
import type { GlowTone } from "../brand/glow-tile";

export type ChartTone = GlowTone;

/** Clair puis sombre (le sombre reprend `--glow-<ton>-a`). */
export const CHART_TONES: Readonly<
  Record<ChartTone, { readonly light: string; readonly dark: string }>
> = {
  yellow: { light: "#FFC529", dark: "#FFC529" },
  amber: { light: "#F08A00", dark: "#FF9A1F" },
  mint: { light: "#13A374", dark: "#34D399" },
  sky: { light: "#1E9AD6", dark: "#38BDF8" },
  rose: { light: "#E5457A", dark: "#FF5C8A" },
  slate: { light: "#7C8799", dark: "#9AA6B8" },
};

export const TONE_ORDER: readonly ChartTone[] = [
  "yellow",
  "amber",
  "mint",
  "sky",
  "rose",
  "slate",
];

/** Ton de la n-ième série (on reboucle au-delà de six). */
export function toneAt(index: number): ChartTone {
  return TONE_ORDER[index % TONE_ORDER.length] ?? "yellow";
}

/** Variable CSS du ton, posée par `chartStyle` (clair et sombre). */
export function toneColor(tone: ChartTone): string {
  return `var(--chart-tone-${tone})`;
}

/** Feuille de style des tons, injectée une fois par graphique. */
export const TONE_CSS = `
[data-chart-tones] { ${TONE_ORDER.map((t) => `--chart-tone-${t}: ${CHART_TONES[t].light};`).join(" ")} }
.dark [data-chart-tones] { ${TONE_ORDER.map((t) => `--chart-tone-${t}: ${CHART_TONES[t].dark};`).join(" ")} }
`;

export const AXIS_TICK = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
} as const;
export const GRID = "var(--border)";
