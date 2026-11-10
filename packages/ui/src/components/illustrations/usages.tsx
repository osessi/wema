/**
 * Usage Wema → figure Hairline. Sans « use client » : une page serveur peut
 * l'importer (depuis un module client, l'objet arriverait vide).
 */
/** Usage Wema → figure. Changer d'image pour un usage se fait ici, et seulement ici. */
export const ILLUSTRATION_FOR = {
  /** Aucun devoir : un classeur dont le tiroir s'ouvre sur du vide. */
  emptyHomework: "drawer",
  /** Aucun message : un routeur aux antennes qui cherchent le signal. */
  emptyMessages: "router",
  /** Aucune classe : une rangée de casiers d'école. */
  emptyClasses: "lockers",
  /** Aucun exercice : un panier vide qui montre son fond. */
  emptyExercises: "basket",
  /** Bienvenue : un ordinateur dont l'écran s'ouvre. */
  welcome: "laptop",
  /** Test de niveau : un ascenseur à quatre étages, qui monte au niveau visé. */
  levelTest: "elevator",
  /** Diagnostic : une loupe posée sur une feuille. */
  diagnostic: "loupe",
  /** Chargement : des caisses sur un tapis roulant. */
  loading: "slow",
  /** Erreur : une prise débranchée qui n'atteint pas la prise murale. */
  error: "plug",
  /** Page introuvable : un point d'interrogation. */
  notFound: "query",
  /** Réussite : des piliers qui s'élèvent. */
  success: "terrain",
} as const;

export type IllustrationUsage = keyof typeof ILLUSTRATION_FOR;
