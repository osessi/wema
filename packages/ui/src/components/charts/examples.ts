/**
 * Données d'exemple pour la vitrine des graphiques. Toutes fictives : aucun
 * élève, aucune classe ni aucun coût réels.
 */
import type { DonutSlice } from "./donut-chart";
import type { RadialItem } from "./radial-chart";
import type { Datum, Series } from "./series";

/** Progression d'une classe de 4e sur 8 semaines (maîtrise moyenne, en %). */
export const classProgress: readonly Datum[] = [
  { semaine: "S1", classe: 41, objectif: 45 },
  { semaine: "S2", classe: 44, objectif: 49 },
  { semaine: "S3", classe: 47, objectif: 53 },
  { semaine: "S4", classe: 46, objectif: 57 },
  { semaine: "S5", classe: 53, objectif: 61 },
  { semaine: "S6", classe: 58, objectif: 64 },
  { semaine: "S7", classe: 63, objectif: 67 },
  { semaine: "S8", classe: 68, objectif: 70 },
];
export const classProgressSeries: readonly Series[] = [
  { key: "classe", label: "Maîtrise moyenne" },
  { key: "objectif", label: "Objectif", tone: "slate" },
];

/** Séances par semaine, avec et sans le prof IA (aires empilées). */
export const weeklySessions: readonly Datum[] = [
  { semaine: "S1", guidees: 38, autonomes: 12 },
  { semaine: "S2", guidees: 42, autonomes: 15 },
  { semaine: "S3", guidees: 40, autonomes: 21 },
  { semaine: "S4", guidees: 35, autonomes: 19 },
  { semaine: "S5", guidees: 44, autonomes: 27 },
  { semaine: "S6", guidees: 47, autonomes: 31 },
  { semaine: "S7", guidees: 45, autonomes: 36 },
  { semaine: "S8", guidees: 49, autonomes: 40 },
];
export const weeklySessionsSeries: readonly Series[] = [
  { key: "guidees", label: "Avec le prof IA" },
  { key: "autonomes", label: "En autonomie", tone: "mint" },
];

/** Notions du programme de 4e, par statut, pour une classe. */
export const notionsByStatus: readonly DonutSlice[] = [
  { name: "Maîtrisées", value: 46, tone: "mint" },
  { name: "En cours", value: 31, tone: "yellow" },
  { name: "Fragiles", value: 14, tone: "amber" },
  { name: "À revoir", value: 9, tone: "rose" },
  { name: "Pas encore vues", value: 22, tone: "slate" },
];

/** Temps passé par matière sur le mois, en minutes, pour un élève. */
export const timeBySubject: readonly Datum[] = [
  { matiere: "Mathématiques", minutes: 412 },
  { matiere: "Français", minutes: 268 },
  { matiere: "Physique-chimie", minutes: 184 },
  { matiere: "SVT", minutes: 131 },
  { matiere: "Anglais", minutes: 96 },
];
export const timeBySubjectSeries: readonly Series[] = [
  { key: "minutes", label: "Temps passé" },
];
/** « 412 min » → « 6 h 52 ». */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Profil d'un élève (sur 100), comparé à la moyenne de sa classe. */
export const studentProfile: readonly Datum[] = [
  { axe: "Compréhension", eleve: 72, classe: 61 },
  { axe: "Autonomie", eleve: 54, classe: 58 },
  { axe: "Régularité", eleve: 81, classe: 63 },
  { axe: "Rigueur", eleve: 66, classe: 60 },
  { axe: "Persévérance", eleve: 77, classe: 64 },
  { axe: "Vitesse", eleve: 48, classe: 57 },
];
export const studentProfileSeries: readonly Series[] = [
  { key: "eleve", label: "L'élève" },
  { key: "classe", label: "Moyenne de la classe", tone: "slate" },
];

/** Avancement par chapitre (en %), pour le graphique radial. */
export const chapterProgress: readonly RadialItem[] = [
  { name: "Nombres relatifs", value: 92 },
  { name: "Fractions", value: 74 },
  { name: "Puissances", value: 58 },
  { name: "Théorème de Pythagore", value: 35 },
];

/** Coûts d'IA par jour sur deux semaines (en dollars, comme la facturation). */
export const aiCostsByDay: readonly Datum[] = [
  { jour: "3 nov.", tuteur: 4.12, correction: 1.84 },
  { jour: "4 nov.", tuteur: 5.37, correction: 2.06 },
  { jour: "5 nov.", tuteur: 6.01, correction: 2.41 },
  { jour: "6 nov.", tuteur: 5.48, correction: 2.12 },
  { jour: "7 nov.", tuteur: 4.73, correction: 1.97 },
  { jour: "8 nov.", tuteur: 1.92, correction: 0.61 },
  { jour: "9 nov.", tuteur: 1.44, correction: 0.48 },
  { jour: "10 nov.", tuteur: 6.35, correction: 2.58 },
  { jour: "11 nov.", tuteur: 6.88, correction: 2.73 },
  { jour: "12 nov.", tuteur: 7.02, correction: 2.95 },
  { jour: "13 nov.", tuteur: 6.47, correction: 2.66 },
  { jour: "14 nov.", tuteur: 5.91, correction: 2.31 },
  { jour: "15 nov.", tuteur: 2.06, correction: 0.72 },
  { jour: "16 nov.", tuteur: 1.58, correction: 0.55 },
];
export const aiCostsSeries: readonly Series[] = [
  { key: "tuteur", label: "Prof IA" },
  { key: "correction", label: "Correction de copies", tone: "sky" },
];
export const formatUsd = (value: number): string =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

/** Mini-courbes des tuiles de chiffres. */
export const sparkMastery: readonly number[] = [41, 44, 47, 46, 53, 58, 63, 68];
export const sparkSessions: readonly number[] = [
  50, 57, 61, 54, 71, 78, 81, 89,
];
