import { defineConfig } from "vitest/config";

// Les tests hachent des mots de passe avec les paramètres scrypt de production
// (environ 128 Mo par calcul) : sous la charge de tous les paquets en parallèle,
// un test peut dépasser les 5 s par défaut sans être en échec.
export default defineConfig({
  test: { testTimeout: 30_000, hookTimeout: 30_000 },
});
