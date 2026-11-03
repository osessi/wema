import { defineConfig } from "vitest/config";

// Chaque scénario crée une base PGlite et y applique toutes les migrations :
// sous la charge de tous les paquets en parallèle, il dépasse les 5 s par défaut
// sans être en échec.
export default defineConfig({
  test: { testTimeout: 60_000, hookTimeout: 60_000 },
});
