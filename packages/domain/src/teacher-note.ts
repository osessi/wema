import { containsHealthTerm } from "./profile";

// Note libre d'un prof sur un élève (écrite ou dictée). Elle entre au journal
// comme observation du prof et le prof IA la lit comme une donnée, jamais
// comme une consigne. La santé n'y a pas sa place : elle passe par les besoins
// déclarés, avec le consentement du parent.

export const TEACHER_NOTE_MIN = 3;
export const TEACHER_NOTE_MAX = 500;

export type TeacherNoteProblem =
  | "too_short"
  | "too_long"
  | "health"
  | "personal_data";

/** Texte gardé : sur une ligne, sans caractère de contrôle ni guillemet français. */
export function cleanTeacherNote(text: string): string {
  return text
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/«\s*/g, '"')
    .replace(/\s*»/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// Une suite de 6 chiffres ou plus (espacés ou non) ressemble à un numéro.
const PHONE = /(?:\d[\s.-]?){6,}/;

/** Ce qui empêche d'enregistrer la note, ou null si elle peut l'être. */
export function teacherNoteProblem(text: string): TeacherNoteProblem | null {
  const note = cleanTeacherNote(text);
  if (note.length < TEACHER_NOTE_MIN) return "too_short";
  if (note.length > TEACHER_NOTE_MAX) return "too_long";
  if (containsHealthTerm(note)) return "health";
  if (EMAIL.test(note) || PHONE.test(note)) return "personal_data";
  return null;
}
