/**
 * Compteur d'échecs en mémoire, par clé (ex. un e-mail ou un identifiant
 * élève) : au-delà de `max` échecs dans la fenêtre, la clé est bloquée
 * jusqu'à la fin de la fenêtre. Suffisant pour un seul serveur ; à déplacer
 * en base quand il y en aura plusieurs.
 */
export function createFailureLimiter(options: {
  max: number;
  windowMs: number;
  now: () => Date;
}) {
  const entries = new Map<string, { count: number; resetAt: number }>();
  const current = (key: string) => {
    const entry = entries.get(key);
    if (entry && entry.resetAt <= options.now().getTime()) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };
  return {
    blocked: (key: string) => (current(key)?.count ?? 0) >= options.max,
    fail(key: string) {
      const entry = current(key) ?? {
        count: 0,
        resetAt: options.now().getTime() + options.windowMs,
      };
      entry.count++;
      entries.set(key, entry);
    },
    reset: (key: string) => {
      entries.delete(key);
    },
  };
}
