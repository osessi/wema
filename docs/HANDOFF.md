# Passation : reprendre le travail sur Wema

Ce document est écrit pour l'agent (ou la personne) qui reprend le projet sans avoir suivi les échanges précédents. Lisez-le en entier avant de toucher au code. Ensuite, lisez `AGENTS.md`, puis `docs/architecture.md`.

_Dernière mise à jour : 1er novembre 2026, lot 2 (socle de l'application) en cours de finition._

---

## 1. Le projet et les personnes

- **Wema** (du fon _wěmà_, « livre, lettre ») est une plateforme qui donne à chaque élève **un prof particulier IA par matière**.
- **Porteur du projet : Olivier Kakpo.** Il parle français, et il faut lui répondre en français. **Associé : Charles Attignon**, professeur particulier. Ses élèves serviront de bêta-testeurs.
- Le projet s'appelait « Maïa » dans la maquette et « Tuteur IA » dans le document de cadrage. Le seul nom valable aujourd'hui est **Wema**.

## 2. Ce qu'Olivier veut vraiment (à respecter)

Le cœur du produit, c'est **l'individualisation la plus fine possible** de l'enseignement. Ce n'est pas d'empiler des écrans. Olivier a été très clair : il ne veut pas qu'on développe les 9 écrans de la maquette. Il veut un **cœur compact, sophistiqué et solide, qui s'améliore avec le temps**.

Le cycle central à construire :

1. **Entretien initial.** L'IA, à l'oral, avec des mini-épreuves sous forme de jeu, complétée par le parent et le prof. Il fait émerger le profil de l'élève : niveau, bases, rythme, attention, besoins de type dys ou TDAH, formats qui marchent (schémas, **bande dessinée**, audio, centres d'intérêt).
2. **Profil de l'élève**, ou « jumeau pédagogique ». Chaque affirmation a une source, un niveau de confiance et des **preuves**. C'est ce qui donne le **profil explicable**, montré au parent et au prof.
3. **Banque d'exercices hebdomadaire par notion**, proposée par l'IA au prof.
4. **Le prof sélectionne ou dépose ses propres exercices.**
5. **L'IA décline chaque exercice en une variante par élève.** Ce qui est évalué reste le même ; la forme, la difficulté, les indices et le contexte changent.
6. **Suivi actif.** « Tu as fait l'exercice ? », questions sur le cours, re-tests espacés.
7. **Les résultats alimentent le profil**, et le système apprend ce qui marche.

Le « prof » peut être un enseignant d'école, un prof particulier, un coach, ou l'équipe de suivi Wema. Le cœur ne fait pas la différence : c'est un **rôle**.

Idées validées par Olivier :
- **le mode « explique-moi »** : l'élève enseigne la notion, l'IA joue l'élève naïf. Olivier a beaucoup aimé ;
- la vérification orale (« explique-moi en 30 secondes comment tu as trouvé ») ;
- les manipulables interactifs plutôt que la vidéo ;
- l'apprentissage collectif anonymisé ;
- un banc d'essai qualité automatique (`evals/`) ;
- une IA interchangeable.

## 3. Règles de conduite avec Olivier (importantes)

- **Le prix est par matière.** Ne jamais affirmer qu'il est « toutes matières ». La maquette l'affiche à tort. Le modèle économique est secondaire et peut changer : ce n'est pas un sujet technique.
- **Aucun cliché sur le Bénin ou l'Afrique.** Ne jamais justifier une fonctionnalité par « la connexion est faible », ni par un préjugé du même genre. Olivier l'a vécu, à juste titre, comme du mépris. Tous les marchés sont traités à égalité (règle n°8 d'`AGENTS.md`).
- **Planifier avant de coder.** Il veut comprendre et valider. On écrit un plan par lot dans `docs/plan/`, on le fait valider, puis on l'exécute.
- **Être direct et honnête** sur ce qui est vérifié et ce qui ne l'est pas.
- **Il dicte à la voix** : ses messages peuvent arriver mal transcrits, voire traduits en anglais. Reconstituez le sens, reformulez, et posez vos questions **par lots, dans une popup** (outil de questions), jamais une à une.
- **Git :** commits locaux au fil de l'eau ; on **ne pousse que quand il le demande**, par gros lots ; **c'est lui qui fusionne** sur GitHub. Il ne veut pas connecter l'outil `gh` à son compte.
- **On développe toute l'application**, pas seulement le cœur : chaque lot est une **tranche complète** (cœur, serveur, écrans).

## 4. Où sont les choses

| Quoi                                 | Où                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| Dépôt                                | `https://github.com/osessi/wema`                                                              |
| Règles pour les agents               | `AGENTS.md` (source unique) ; `CLAUDE.md` l'importe                                           |
| Architecture du cœur                 | `docs/architecture.md`                                                                        |
| Vocabulaire français ↔ code          | `docs/glossaire.md`                                                                           |
| Décisions d'architecture             | `docs/decisions/` : 0001 socle, 0002 journal, 0003 référentiel en base, 0004 comptes et rôles |
| Plans de lots                        | `docs/plan/` (`lot-01-fondations.md`, `lot-02-socle-application.md`)                          |
| Maquette (9 écrans, ancien nom Maïa) | `docs/reference/maquette/` ; ouvrir `Portail.dc.html` dans un navigateur                      |
| Document de cadrage (sept. 2026)     | `docs/reference/cadrage-2026-09.md`                                                           |
| Contenu pédagogique                  | `content/curriculum/` (YAML)                                                                  |

Remarque : l'outil `claude_design` (DesignSync) n'a pas fonctionné depuis l'extension VS Code. La maquette a donc été exportée à la main dans `docs/reference/maquette/`. Ne la lisez pas en entier (environ 1 Mo) : ciblez l'écran utile.

## 5. Pile technique (décidée)

- Monorepo **pnpm 10 + Turborepo**, **TypeScript 7 strict** partout, **Biome** pour le lint et le format, **Vitest** pour les tests.
- **Node ≥ 22.18**. Sur le Mac d'Olivier, Node 22 et pnpm sont installés dans `~/.local/node` (sans droits administrateur) : ajoutez `export PATH="$HOME/.local/node/bin:$PATH"` à la session.
- **Serveur `apps/api` : Hono**, lancé par `tsx`. **Web `apps/web` : Next.js 16** (App Router) + **next-intl**. TypeScript 7 n'a plus d'API JavaScript : `next build` ne vérifie pas les types (`ignoreBuildErrors`), c'est `pnpm typecheck` qui le fait.
- **Postgres** comme base unique. En développement et dans les tests : **PGlite** (Postgres embarqué), aucun Docker nécessaire. Accès SQL sans ORM (`SqlExecutor`, avec transactions).
- **Connexion** écrite par nous (fiche 0004) : scrypt, sessions opaques en cookie, codes SMS/WhatsApp signés, Google et Apple via `arctic`.
- **Python** uniquement dans `services/math` (à venir). **Pas de Rust.** Applis mobile (Expo) : pas encore générées.

## 6. Démarrer

```sh
export PATH="$HOME/.local/node/bin:$PATH"   # si Node est installé ainsi
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm check:boundaries

cp .env.example .env    # renseigner WEMA_SUPER_ADMIN_EMAIL et WEMA_SUPER_ADMIN_PASSWORD
pnpm --filter @wema/api seed   # jeu d'exemple : France et Bénin, 4 notions de maths chacun
pnpm --filter @wema/api dev    # API sur http://localhost:4000/api (base PGlite dans apps/api/.data)
pnpm --filter @wema/web dev    # back-office sur http://localhost:3000
```

Sans prestataire SMS/WhatsApp, les codes de connexion par téléphone s'affichent dans la console de l'API (développement seulement).

## 7. État actuel

### Branches

- `main` contient le lot 1 (PR n°1 fusionnée par Olivier).
- **`lot-02-socle-application`** : lot 2, commits locaux, **pas encore poussé** (attendre qu'Olivier le demande).

### Ce que fait chaque paquet

| Paquet                                                   | État     | Contenu                                                                                                                                                                                                                      |
| -------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@wema/domain`                                           | ✅       | identifiants marqués, `Result`, hiérarchie du référentiel (pays, classe, matière, programme, unité, notion, idée fausse), `LearningEvent`, catalogue des **permissions** et leur portée, organisations, rôles, appartenances |
| `@wema/curriculum`                                       | ✅       | `assembleCurriculum` (validation d'un pays), `checkPrerequisiteChange` (cycles, autre pays, archives), `loadCurriculumSeed` (jeu d'exemple, identifiants déterministes)                                                      |
| `@wema/learner-model`                                    | ✅       | BKT, projection du profil, **réglages pédagogiques** validés (`parseLearnerModelSettings`, `DEFAULT_SETTINGS`)                                                                                                               |
| `@wema/access`                                           | ✅ lot 2 | mots de passe, jetons, codes à usage unique, normalisation des identifiants, `can` / `effectivePermissions`, `CodeSender`                                                                                                    |
| `@wema/db`                                               | ✅       | migrations 0001 (journal) et 0002 (comptes, rôles, référentiel, réglages, audit) ; dépôts ; `bootstrapPlatform`                                                                                                              |
| `@wema/ui`                                               | ✅ lot 2 | jetons de la charte et composants de base                                                                                                                                                                                    |
| `apps/api`                                               | ✅ lot 2 | connexion (e-mail, téléphone, Google, Apple, élève), administration (référentiel, organisations, rôles, membres, réglages, audit), import du jeu d'exemple                                                                   |
| `apps/web`                                               | 🟡 lot 2 | back-office : connexion, accueil, référentiel, matières, organisations, rôles, membres, réglages, journal                                                                                                                    |
| `@wema/exercises`, `tutor`, `orchestrator`, `ai-gateway` | ⬜       | coquilles vides                                                                                                                                                                                                              |
| `apps/mobile`, `services/math`                           | ⬜       | coquilles vides                                                                                                                                                                                                              |

### Règles pédagogiques en vigueur

- **Statuts :** `not_seen`, `needs_work`, `in_progress` (dès le seuil « En cours », 0,5 par défaut), `mastered`.
- **Validation :** maîtrise ≥ seuil « Validé » (0,95) **et** une bonne réponse au moins N heures après le passage du seuil (72 h par défaut).
- **Idée fausse :** active dès qu'elle apparaît, inactive après N bonnes réponses (2 par défaut).
- Ces valeurs sont **réglables dans le back-office** (Réglages pédagogiques). Le profil étant recalculé depuis le journal, un changement s'applique aussi à l'historique.

### Référentiel

Géré dans le back-office, stocké en base (fiche 0003). Les notions sont propres à chaque pays ; le nom des unités est choisi par pays. `content/curriculum/` n'est plus qu'un jeu d'exemple (France « Chapitre », Bénin « Situation d'apprentissage »), tout en `verified: false`.

## 8. Questions ouvertes à poser à Olivier

Tranché le 1er novembre 2026 : PR n°1 fusionnée ; seuils rendus réglables ; notions propres à chaque pays ; rôles configurables ; trois segments en parallèle (familles, profs, écoles) ; Wema « tout IA », avec validation du prof en B2B ; pas de date ferme.

Encore ouvert :
1. **Indices :** quel poids pour une bonne réponse obtenue avec des indices (`hintsUsed` ignoré par BKT aujourd'hui) ?
2. **Réponse juste avec une idée fausse** : la compter comme juste ?
3. **Besoins dys / TDAH :** déclaration seule, ou aussi repérage de signaux ? (données de santé de mineurs)
4. **Prestataire SMS / WhatsApp** (coût par message) et comptes développeur Google / Apple.
5. Validation des classes et unités du jeu d'exemple par Charles ou un enseignant béninois.

## 9. Défauts mineurs connus (reportés)

Lot 2 :
- pas de limitation des tentatives de connexion par mot de passe (seuls les codes par téléphone sont limités) ;
- pas encore d'e-mail de vérification ni de mot de passe oublié ; pas de QR code de connexion élève ;
- l'import du jeu d'exemple échoue si une matière de même code a été créée à la main avant ;
- connexion Google / Apple testée avec un faux fournisseur seulement (pas de vrai compte développeur).

Issus de la relecture indépendante du lot 1 :
- doublons de pays ou de matières acceptés dans le référentiel ;
- messages d'erreur du référentiel peu lisibles (JSON brut de Zod, `countries` au lieu de `countries.yaml`, cascade de `unknown_prerequisite` après une notion illisible) ;
- `loadCurriculum` lève `ENOENT` si le dossier racine n'existe pas, au lieu de renvoyer un `Result` ;
- aucune vérification de cohérence entre dossier, matière et préfixe d'`id` ; `files` et `notions` sont deux tableaux parallèles dans `CurriculumInput` (mieux : des paires `{ file, data }`) ;
- **`occurredAt` dans le futur accepté** : un téléphone qui avance de 3 jours suffit à valider une notion. À borner dans l'API d'ajout (comparer à l'heure du serveur et à `recorded_at`) ;
- `"types": ["node"]` dans `tsconfig.base.json` s'applique aussi à `domain` et `ui`, qui tourneront dans le navigateur ;
- `engines.node` vaut `>=22` alors qu'il faut `>=22.18` ;
- `migrate` envoie BEGIN et COMMIT par des `exec` séparés, ce qui ne marchera pas avec un pool `pg`. Il faudra un `transaction()` dans `SqlExecutor`, et un verrou consultatif ;
- Python (ruff, pytest) absent de la CI ;
- `NotionState` n'a pas de « date du dernier rappel » et `MisconceptionState` n'a pas de niveau de confiance : écart avec l'architecture §2.3 et la règle n°4.

## 10. Feuille de route (tranches complètes, validée par Olivier le 1er novembre 2026)

| Lot                              | Ce qu'on peut montrer à la fin                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **2. Socle de l'application**    | back-office : référentiel en base, organisations, comptes, rôles configurables, réglages (en cours de finition) |
| **3. Premier prof IA**           | passerelle IA et prof de maths dans l'app élève : questionne, indices, ne donne jamais la réponse               |
| **4. Exercices et console prof** | vérification des maths (`services/math`), variantes par élève, banque hebdo, choix du prof                      |
| **5. Entretien et parents**      | entretien initial, profil explicable, espace parent                                                             |
| **6. Suivi actif et mobile**     | relances, re-tests espacés, app Expo                                                                            |
| **7. Écoles**                    | console école, marque blanche, rapports                                                                         |
| **8. Bêta**                      | Charles et ses élèves, puis une école pilote                                                                    |

Avant chaque lot : un plan court validé par Olivier, puis `docs/plan/lot-XX-….md`.

## 11. Méthode de travail

- Les tests s'écrivent d'abord (TDD) : on voit chaque test échouer pour la bonne raison, puis passer.
- Un commit par tâche, en français, avec la ligne `Co-Authored-By` de l'agent.
- Avant chaque commit : `pnpm exec biome check --write .`, puis `pnpm lint`, `pnpm typecheck`, `pnpm test` et `pnpm check:boundaries`.
- À la fin d'un lot, une relecture indépendante de toute la branche. On corrige les points importants avec un test, et on liste les mineurs dans la PR et ici.
