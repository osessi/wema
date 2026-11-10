import { containsHealthTerm, isSafeInterestLabel } from "./profile";

// Prénom et avatar du prof IA, choisis par l'élève : un réglage d'affichage,
// pas une hypothèse sur l'élève (il n'entre donc pas au journal).

/** Galerie fermée d'avatars dessinés (aucune photo, aucune personne réelle). */
export const TUTOR_AVATARS = [
  "sun",
  "owl",
  "leaf",
  "cloud",
  "star",
  "initial",
] as const;

export type TutorAvatar = (typeof TUTOR_AVATARS)[number];

export function isTutorAvatar(value: string): value is TutorAvatar {
  return TUTOR_AVATARS.some((a) => a === value);
}

/** Longueur d'un prénom de prof IA, en caractères. */
export const TUTOR_NAME_MIN = 2;
export const TUTOR_NAME_MAX = 20;

// Insultes et grossièretés courantes (sans accents, en minuscules). La liste
// n'est pas exhaustive : elle écarte l'évident, le prénom reste un réglage
// privé de l'élève, montré à lui seul.
const INSULTS =
  /\b(con(ne|nard|nasse)?s?|merde|putes?|putain|salope?s?|encule|nique|niquer|batard|fdp|pd|connasse|bite|couille?s?|chier|enfoire|abruti|debile|cretin|idiot|imbecile|bouffon|gueule|nazi|hitler|negr\w*)\b/;

const plain = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Prénom tel qu'il est gardé : espaces resserrés. */
export function normalizeTutorName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Prénom du prof IA : court, des lettres seulement (aucun chiffre, adresse ou
 * numéro, donc aucune consigne glissée dans le prompt), sans mention de santé
 * ni insulte. Même garde-fou que les centres d'intérêt, en plus court.
 */
export function isSafeTutorName(name: string): boolean {
  const n = normalizeTutorName(name);
  return (
    n.length >= TUTOR_NAME_MIN &&
    n.length <= TUTOR_NAME_MAX &&
    isSafeInterestLabel(n) &&
    !containsHealthTerm(n) &&
    !INSULTS.test(plain(n))
  );
}

/** Prof IA personnalisé : pour toutes les matières (`subjectId` nul) ou une seule. */
export interface TutorPersona {
  subjectId: string | null;
  name: string;
  avatar: TutorAvatar;
}

/** Réglage d'une matière s'il existe, sinon celui de toutes les matières. */
export function resolveTutorPersona(
  personas: readonly TutorPersona[],
  subjectId: string | null,
): TutorPersona | null {
  return (
    (subjectId !== null
      ? personas.find((p) => p.subjectId === subjectId)
      : undefined) ??
    personas.find((p) => p.subjectId === null) ??
    null
  );
}
