/**
 * Bibliothèque de graphiques de Wema (Recharts + primitive shadcn `ui/chart`).
 * Import : `@wema/ui/components/charts/index`.
 *
 * Une forme par besoin : aire (une quantité dans le temps), barres
 * (catégories comparées), ligne (une tendance), anneau (les parts d'un tout),
 * radial (quelques catégories contre un même maximum), radar (un profil),
 * sparkline (une mini-courbe). Chaque graphique exige un `label` accessible
 * et rend un résumé ou un tableau masqué pour les lecteurs d'écran.
 */
export { AreaChart, type AreaChartProps } from "./area-chart";
export { BarChart, type BarChartProps } from "./bar-chart";
export {
  DonutChart,
  type DonutChartProps,
  type DonutSlice,
} from "./donut-chart";
export * as chartExamples from "./examples";
export { LineChart, type LineChartProps } from "./line-chart";
export {
  CHART_TONES,
  type ChartTone,
  TONE_ORDER,
  toneColor,
} from "./palette";
export { RadarChart, type RadarChartProps } from "./radar-chart";
export {
  RadialChart,
  type RadialChartProps,
  type RadialItem,
} from "./radial-chart";
export {
  compactNumber,
  type Datum,
  formatNumber,
  type Series,
  type ValueFormatter,
} from "./series";
export { Sparkline, type SparklineProps } from "./sparkline";
