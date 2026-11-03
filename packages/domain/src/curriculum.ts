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

/** Matière, commune à tous les pays : un prof IA par matière. */
export interface Subject {
  id: SubjectId;
  /** Code lisible et stable (ex. maths). */
  code: string;
  name: string;
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
