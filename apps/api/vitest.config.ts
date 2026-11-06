import { defineConfig } from "vitest/config";

// Les tests de l'API hachent des mots de passe (scrypt) et démarrent une base
// à chaque scénario : sous la charge de tous les paquets en parallèle, un
// scénario peut dépasser 30 s sans être en échec (scénarios de messagerie et de droits à plusieurs comptes).
export default defineConfig({
  test: { testTimeout: 90_000, hookTimeout: 90_000 },
});
