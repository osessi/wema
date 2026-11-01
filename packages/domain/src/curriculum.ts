import type { CountryCode, MisconceptionId, NotionId, SubjectId } from "./ids";

export interface Country {
  code: CountryCode;
  name: string;
}

export interface Subject {
  id: SubjectId;
  name: string;
}

/** Erreur de raisonnement typique d'une notion. */
export interface Misconception {
  id: MisconceptionId;
  description: string;
}

/** Place d'une notion dans le programme d'un pays. */
export interface CurriculumMapping {
  grade: string;
  chapter: number | null;
  /** Vrai une fois validé par un enseignant du pays. */
  verified: boolean;
}

export interface Notion {
  id: NotionId;
  subjectId: SubjectId;
  name: string;
  description: string;
  prerequisites: readonly NotionId[];
  misconceptions: readonly Misconception[];
  mappings: Readonly<Partial<Record<CountryCode, CurriculumMapping>>>;
}
