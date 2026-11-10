/** Seuil sous lequel une hypothèse s'affiche « à vérifier », quel que soit son sens. */
const SURE_ENOUGH = 0.5;

/**
 * Statut affiché d'une hypothèse du profil. Une hypothèse « plutôt vraie »
 * ou « plutôt fausse » avec une confiance faible reste à vérifier : on ne
 * l'affirme pas devant l'élève, sa famille ou son prof.
 */
export function shownStatus(h: {
  status: "supported" | "uncertain" | "contradicted";
  confidence: number;
}): "supported" | "uncertain" | "contradicted" {
  return h.confidence < SURE_ENOUGH ? "uncertain" : h.status;
}

/** Couleur du badge d'une hypothèse, selon son statut affiché. */
export const hypothesisBadge = {
  supported: "success",
  uncertain: "neutral",
  contradicted: "danger",
} as const;
