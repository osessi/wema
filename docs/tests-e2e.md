# Tests de bout en bout (Playwright)

La suite `e2e/` joue de vrais parcours dans un navigateur, sur l'API, le web et `services/math` réels. Elle tourne en local et dans la CI (`.github/workflows/e2e.yml`).

## Lancer

```sh
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"   # Node, pnpm et uv sur le Mac d'Olivier
docker compose -f infra/docker-compose.yml up -d              # Postgres
pnpm --filter @wema/e2e exec playwright install chromium      # une fois
pnpm e2e
```

`pnpm e2e` fait tout :

1. **services/math** : celui du développement (port 8000) s'il répond, sinon il est démarré avec `uv`.
2. **API sur le port 4100**, sur la base `wema_e2e` (`e2e/scripts/start-api.sh`) :
   - la base est **recréée vide** (`pnpm --filter @wema/api db:reset`, refusé en production et pour toute base dont le nom ne finit pas par `_e2e` ou `_test`) ;
   - puis les migrations, le référentiel et les exercices d'exemple (`seed`), et le serveur.
3. **Web sur le port 3100** (`next dev`, dossier `.next-e2e`, relié à l'API 4100).
4. `e2e/global-setup.ts` : jeu de démonstration (`seed:demo`), conditions acceptées, une session enregistrée par compte (`e2e/.auth/`).
5. Les scénarios, en parallèle, en format bureau (projet `chromium`) et téléphone 390 × 844 (projet `mobile`, scénarios marqués `@mobile`).

Rien ne touche la base `wema` ni les ports 3000 et 4000 du développement.

**Pas d'IA réelle.** L'API des tests démarre sans `OPENROUTER_API_KEY` et sans lire le `.env` : l'IA est « indisponible », et les écrans doivent le gérer proprement (c'est vérifié). Aucun mode « IA simulée » n'a été nécessaire.

**Paiement.** Sans clés Stripe ni Kkiapay, l'API de développement utilise le faux fournisseur, qui simule un paiement réussi.

### Options

| Commande ou variable                                  | Effet                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm e2e tests/parent.spec.ts`                       | un seul fichier                                                    |
| `pnpm e2e -g "paiement"`                              | les scénarios dont le titre contient « paiement »                  |
| `pnpm e2e --project chromium`                         | sans le format téléphone                                           |
| `pnpm e2e --ui` ou `--headed`                         | voir le navigateur                                                 |
| `pnpm --filter @wema/e2e exec playwright show-report` | rapport de la dernière exécution (traces des échecs)               |
| `E2E_DATABASE_URL`                                    | autre base (défaut `postgres://wema:wema@localhost:5432/wema_e2e`) |
| `E2E_API_PORT`, `E2E_WEB_PORT`, `E2E_MATH_URL`        | autres ports                                                       |

**Serveurs réutilisés (en local seulement).** Si l'API 4100 et le web 3100 tournent déjà, Playwright les réutilise sans remettre la base à zéro : pratique pour écrire un scénario. Pour une exécution propre, arrêtez-les ; la CI démarre toujours tout à neuf.

## Ce qui est vérifié à chaque scénario

La fixture `e2e/support/fixtures.ts` surveille chaque page ouverte :

- erreurs dans la console du navigateur ;
- exceptions non rattrapées ;
- réponses HTTP 5xx.

S'il y en a une, le scénario échoue, avec la liste. Une erreur **voulue** (par exemple le 401 d'un mauvais mot de passe, que Chrome signale dans la console) se déclare dans le scénario :

```ts
test.use({ allowedConsole: [/status of 401/] });
```

## Les scénarios

| Fichier            | Parcours                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.spec.ts`     | connexion par e-mail, par compte élève (identifiant et code), déconnexion, inscription avec les conditions, refus                                                        |
| `learner.spec.ts`  | accueil, exercice (« Pas encore » puis « Bravo »), progression ; formats schéma et lecture facile ; prof IA sans IA                                                      |
| `teacher.spec.ts`  | carte de la classe, donner un devoir que l'élève voit ; banque : déposer, retenir, donner                                                                                |
| `school.spec.ts`   | créer une classe, ajouter un élève par identifiant (code affiché), l'inscrire, il se connecte                                                                            |
| `parent.spec.ts`   | fiche de l'enfant, besoin déclaré avec consentement puis retiré ; paiement d'un enfant hors contrat                                                                      |
| `family.spec.ts`   | famille sans école : le parent s'inscrit, crée sa famille, ajoute un enfant (France, 4e, maths), lance l'essai ; l'enfant se connecte avec son code et ouvre un exercice |
| `messages.spec.ts` | prof → élève → réponse ; un élève ne peut pas écrire à un autre élève (interface et API)                                                                                 |
| `agenda.spec.ts`   | disponibilité du prof, réservation par l'élève, confirmation                                                                                                             |
| `rgpd.spec.ts`     | export des données téléchargé                                                                                                                                            |
| `admin.spec.ts`    | référentiel (créer une notion), réglages pédagogiques                                                                                                                    |
| `access.spec.ts`   | un élève qui tape `/admin`, `/prof`… est renvoyé ; sans session, retour à la connexion                                                                                   |
| `pages.spec.ts`    | page 404 ; thème sombre dans tous les espaces                                                                                                                            |

## Ajouter un scénario

1. Créez `e2e/tests/<sujet>.spec.ts` et importez `test` et `expect` depuis `../support/fixtures` (jamais directement depuis `@playwright/test` : on perdrait la surveillance des erreurs).
2. **Données propres au scénario.** Les scénarios tournent en parallèle sur la même base : créez vos comptes avec `e2e/support/api.ts`, plutôt que de modifier les comptes de démonstration.
   - `createSchoolWorld(admin)` : une classe neuve du Collège démo, avec la prof de démo et un élève neuf ;
   - `createFamilyWorld(admin)` : un parent et un enfant inscrit dans une école sans contrat ;
   - `createEmailMember`, `giveAssignment`, `platformExercise`, `ensureOffer`, `unique()` pour des noms uniques.
3. **Ouvrir une page connectée** : `const page = await pageAs("prof")` (compte de démo) ou `pageAs(world.learner)` (compte créé). Le format (bureau ou téléphone) suit le projet.
4. **Sélecteurs** : par rôle et par nom accessible, comme un utilisateur (`getByRole("button", { name: "Donner le devoir" })`, `getByLabel(...)`). Pas de classes CSS ni de `waitForTimeout` : attendez un résultat visible avec `expect`.
5. Ajoutez `@mobile` au titre si le parcours doit aussi être joué au format téléphone.
6. Lancez-le deux fois de suite (`pnpm e2e tests/<sujet>.spec.ts --repeat-each 2`) : un scénario fragile se corrige, il ne se relance pas (pas de nouvel essai automatique).

Le champ de réponse mathématique est un `<math-field>` (MathLive) : voir `answer()` dans `learner.spec.ts`.
