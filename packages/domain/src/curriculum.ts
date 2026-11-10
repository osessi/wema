import type {
  CountryCode,
  CountryId,
  GradeId,
  MisconceptionId,
  NotionId,
  ProgramId,
  SubjectId,
  UnitId,
} from "./ids";

// Référentiel : pays → classe → programme (classe × matière) → unité → notion.
// Les matières sont communes à tous les pays ; tout le reste appartient à un
// pays, y compris les notions (fiche de décision 0003). Rien n'est supprimé :
// on archive, car le journal d'événements peut y faire référence.

export interface Country {
  id: CountryId;
  code: CountryCode;
  name: string;
  /** Nom des unités du programme dans ce pays (situation d'apprentissage, chapitre…). */
  unitLabel: { singular: string; plural: string };
  archived: boolean;
}

/**
 * Liste fermée des icônes de matière. Chaque matière en choisit une dans le
 * référentiel (aucune n'est déduite du code d'une matière dans l'application) ;
 * `@wema/ui` (`SubjectIcon`) en donne le dessin.
 */
export const SUBJECT_ICONS = [
  "math",
  "french",
  "language",
  "science",
  "physics",
  "chemistry",
  "biology",
  "history",
  "geography",
  "philosophy",
  "economics",
  "computer",
  "art",
  "music",
  "sport",
  "book",
  "globe",
] as const;

export type SubjectIconKey = (typeof SUBJECT_ICONS)[number];

export function isSubjectIcon(value: string): value is SubjectIconKey {
  return SUBJECT_ICONS.some((i) => i === value);
}

/** Icône lue en base : une valeur hors de la liste fermée vaut « aucune ». */
export function toSubjectIcon(
  value: string | null | undefined,
): SubjectIconKey | null {
  return value != null && isSubjectIcon(value) ? value : null;
}

/** Matière, commune à tous les pays : un prof IA par matière. */
export interface Subject {
  id: SubjectId;
  /** Code lisible et stable (ex. maths). */
  code: string;
  name: string;
  /** Icône choisie dans `SUBJECT_ICONS` ; nulle tant qu'aucune n'est choisie. */
  icon: SubjectIconKey | null;
  archived: boolean;
}

/** Classe (niveau scolaire) d'un pays, ordonnée par `position`. */
export interface Grade {
  id: GradeId;
  countryId: CountryId;
  name: string;
  position: number;
  archived: boolean;
}

/** Contenu d'une matière pour une classe d'un pays. */
export interface Program {
  id: ProgramId;
  countryId: CountryId;
  gradeId: GradeId;
  subjectId: SubjectId;
  archived: boolean;
}

/** Regroupement de notions d'un programme, ordonné par `position`. */
export interface Unit {
  id: UnitId;
  programId: ProgramId;
  name: string;
  description: string;
  position: number;
  archived: boolean;
}

/** Erreur de raisonnement typique d'une notion. */
export interface Misconception {
  id: MisconceptionId;
  notionId: NotionId;
  description: string;
  archived: boolean;
}

export interface Notion {
  id: NotionId;
  unitId: UnitId;
  /** Code lisible, unique dans le pays (ex. pythagore). */
  code: string;
  name: string;
  description: string;
  position: number;
  /** Notions du même pays à maîtriser avant celle-ci. */
  prerequisites: readonly NotionId[];
  misconceptions: readonly Misconception[];
  /** Vrai une fois validée par un enseignant du pays. */
  verified: boolean;
  archived: boolean;
}
