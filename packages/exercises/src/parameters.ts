import type { ParameterSpec } from "@wema/domain";

/** Graine stable tirée d'un texte (FNV-1a 32 bits) : même élève, même exercice, même graine. */
export function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Valeurs des paramètres pour un niveau et une graine : chaque paramètre est
 * tiré dans la plage du niveau (la dernière plage sert au-delà), hors valeurs
 * interdites. Renvoie `null` si une plage ne contient aucune valeur permise.
 */
export function chooseParameters(
  specs: readonly ParameterSpec[],
  level: number,
  seed: number,
): Record<string, number> | null {
  const next = random(seed);
  const values: Record<string, number> = {};
  for (const spec of specs) {
    const range =
      spec.ranges[Math.min(level, spec.ranges.length) - 1] ?? spec.ranges[0];
    if (!range) return null;
    const allowed: number[] = [];
    for (let v = range.min; v <= range.max && allowed.length <= 20_001; v++) {
      if (!spec.exclude.includes(v)) allowed.push(v);
    }
    const value = allowed[Math.floor(next() * allowed.length)];
    if (value === undefined) return null;
    values[spec.name] = value;
  }
  return values;
}
