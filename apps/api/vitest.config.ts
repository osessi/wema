import { defineConfig } from "vitest/config";

// Les tests de l'API hachent des mots de passe (scrypt) et démarrent une base
// à chaque scénario : sous la charge de tous les paquets en parallèle, un
// scénario peut dépasser les 5 s par défaut sans être en échec.
export default defineConfig({
  test: { testTimeout: 30_000, hookTimeout: 30_000 },
});
