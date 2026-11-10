# Passation : reprendre le travail sur Wema

Ce document est écrit pour l'agent (ou la personne) qui reprend le projet sans avoir suivi les échanges précédents. Lisez-le en entier avant de toucher au code. Ensuite, lisez `AGENTS.md`, puis `docs/architecture.md`.

_Dernière mise à jour : 3 novembre 2026 (soir). Lots 1 à 11 livrés sur la branche `lot-09-front-end` (lots 9 à 11 pas encore poussés) : back-end, web, IA réelle (Claude Haiku 5.5), mobile, envois, RGPD, paiement, formats adaptés, collectif, agenda et visio, mise en production. Lire `docs/plan/lot-09-front-end.md`, `lot-10-bout-en-bout.md` et `lot-11-tout-le-produit.md` (comptes à ouvrir, points à trancher). Le développement tourne sur Postgres (Docker, `infra/docker-compose.yml`). Jeu de démonstration : `pnpm --filter @wema/api seed`, puis `seed:demo`. Une seule instance de l'API à la fois._

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
- **D'abord tout le back-end, ensuite le front-end** (décision du 1er novembre 2026, qui remplace les « tranches complètes ») : chaque lot livre de la logique et des routes d'API testées. Le front-end sera fait avec **shadcn/ui** et les bibliothèques qu'Olivier fournira. Le back-office actuel (`apps/web`, `@wema/ui`) n'est qu'un outil de test : n'investissez pas dans son design.
- **IA :** passerelle avec deux branchements interchangeables, **OpenRouter** (en premier) et **Vercel AI SDK**.

## 4. Où sont les choses

| Quoi                                 | Où                                                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Dépôt                                | `https://github.com/osessi/wema`                                                                                                         |
| Règles pour les agents               | `AGENTS.md` (source unique) ; `CLAUDE.md` l'importe                                                                                      |
| Architecture du cœur                 | `docs/architecture.md`                                                                                                                   |
| Vocabulaire français ↔ code          | `docs/glossaire.md`                                                                                                                      |
| Décisions d'architecture             | `docs/decisions/` : 0001 socle, 0002 journal, 0003 référentiel en base, 0004 comptes et rôles, 0005 services/math, 0006 données de santé |
| Plans de lots                        | `docs/plan/` (`lot-01-fondations.md`, `lot-02-socle-application.md`)                                                                     |
| Maquette (9 écrans, ancien nom Maïa) | `docs/reference/maquette/` ; ouvrir `Portail.dc.html` dans un navigateur                                                                 |
| Document de cadrage (sept. 2026)     | `docs/reference/cadrage-2026-09.md`                                                                                                      |
| Contenu pédagogique                  | `content/curriculum/` (YAML)                                                                                                             |

Remarque : l'outil `claude_design` (DesignSync) n'a pas fonctionné depuis l'extension VS Code. La maquette a donc été exportée à la main dans `docs/reference/maquette/`. Ne la lisez pas en entier (environ 1 Mo) : ciblez l'écran utile.

## 5. Pile technique (décidée)

- Monorepo **pnpm 10 + Turborepo**, **TypeScript 7 strict** partout, **Biome** pour le lint et le format, **Vitest** pour les tests.
- **Node ≥ 22.18**. Sur le Mac d'Olivier, Node 22 et pnpm sont installés dans `~/.local/node` (sans droits administrateur) : ajoutez `export PATH="$HOME/.local/node/bin:$PATH"` à la session.
- **Serveur `apps/api` : Hono**, lancé par `tsx`. **Web `apps/web` : Next.js 16** (App Router) + **next-intl**. TypeScript 7 n'a plus d'API JavaScript : `next build` ne vérifie pas les types (`ignoreBuildErrors`), c'est `pnpm typecheck` qui le fait.
- **Postgres** comme base unique. En développement et dans les tests : **PGlite** (Postgres embarqué), aucun Docker nécessaire. Accès SQL sans ORM (`SqlExecutor`, avec transactions).
- **Connexion** écrite par nous (fiche 0004) : scrypt, sessions opaques en cookie, codes SMS/WhatsApp signés, Google et Apple via `arctic`.
- **Python 3.12** uniquement dans `services/math` (FastAPI + SymPy), géré par **uv** (installé dans `~/.local/bin/uv` sur le Mac d'Olivier). **Pas de Rust.** Applis mobile (Expo) : pas encore générées.

## 6. Démarrer

```sh
export PATH="$HOME/.local/node/bin:$PATH"   # si Node est installé ainsi
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm check:boundaries

cp .env.example .env    # renseigner WEMA_SUPER_ADMIN_EMAIL et WEMA_SUPER_ADMIN_PASSWORD
(cd services/math && ~/.local/bin/uv run uvicorn wema_math.app:app --port 8000)   # à laisser tourner
pnpm --filter @wema/api seed   # jeu d'exemple : France et Bénin, 4 notions et 4 exercices chacun
pnpm --filter @wema/api dev    # API sur http://localhost:4000/api (base PGlite dans apps/api/.data)
pnpm --filter @wema/web dev    # application sur http://localhost:3000/app
```

Sans prestataire SMS/WhatsApp, les codes de connexion par téléphone s'affichent dans la console de l'API (développement seulement).

## 7. État actuel

### Branches

- `main` contient le lot 1 (PR n°1 fusionnée par Olivier).
- **`lot-02-socle-application`** : lot 2, relu et corrigé, **pas encore poussé**.
- **`lot-03-exercices`** (partie du lot 2) : lot 3, relu et corrigé, **pas encore poussé**.
- **`lot-04-passerelle-ia`** (partie du lot 3) : lot 4, relu et corrigé.
- **`lot-05-prof-ia`** (partie du lot 4) : lot 5, relu ; corrections faites sur la branche du lot 6.
- **`lot-06-profil-entretien`** (partie du lot 5) : lot 6, relu ; corrections faites sur la branche du lot 7.
- **`lot-07-suivi-actif`** (partie du lot 6) : lot 7, relu ; corrections faites sur la branche du lot 8.
- **`lot-08-api-espaces`** (partie du lot 7) : lot 8, relu et corrigé. **C'est la branche la plus à jour.** Rien n'est poussé : Olivier poussera l'ensemble quand il le décidera.

### Ce que fait chaque paquet

| Paquet                                                   | État     | Contenu                                                                                                                                                                                                                      |
| -------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@wema/domain`                                           | ✅       | identifiants marqués, `Result`, hiérarchie du référentiel (pays, classe, matière, programme, unité, notion, idée fausse), `LearningEvent`, catalogue des **permissions** et leur portée, organisations, rôles, appartenances |
| `@wema/curriculum`                                       | ✅       | `assembleCurriculum` (validation d'un pays), `checkPrerequisiteChange` (cycles, autre pays, archives), `loadCurriculumSeed` (jeu d'exemple, identifiants déterministes)                                                      |
| `@wema/learner-model`                                    | ✅       | BKT, projection du profil, **réglages pédagogiques** validés (`parseLearnerModelSettings`, `DEFAULT_SETTINGS`)                                                                                                               |
| `@wema/access`                                           | ✅ lot 2 | mots de passe, jetons, codes à usage unique, normalisation des identifiants, `can` / `effectivePermissions`, `CodeSender`                                                                                                    |
| `@wema/db`                                               | ✅       | migrations 0001 (journal) et 0002 (comptes, rôles, référentiel, réglages, audit) ; dépôts ; `bootstrapPlatform`                                                                                                              |
| `@wema/ui`                                               | ✅ lot 9 | composants shadcn/ui (Radix), jetons de la charte (Crayon et Nuit, pastels par matière), polices                                                                                                                             |
| `apps/api`                                               | ✅ lot 2 | connexion (e-mail, téléphone, Google, Apple, élève), administration (référentiel, organisations, rôles, membres, réglages, audit), import du jeu d'exemple                                                                   |
| `apps/web`                                               | ✅ lot 9 | Next.js 16 : espaces élève (`/eleve`), prof (`/prof`), parent (`/parent`), école (`/ecole`), back-office (`/admin`), connexion et inscription                                                                                |
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

Tranché le 1er novembre 2026 (données de santé, fiche 0006) : besoins déclarés par le parent ou le prof, consentement du parent toujours exigé et enregistré ; visibles par une autre organisation seulement si le parent les partage ; l'équipe Wema peut les lire, chaque lecture est tracée. Également tranché : PR n°1 fusionnée ; seuils rendus réglables ; notions propres à chaque pays ; rôles configurables ; trois segments en parallèle (familles, profs, écoles) ; Wema « tout IA », avec validation du prof en B2B ; pas de date ferme.

Encore ouvert :
1. **Indices :** quel poids pour une bonne réponse obtenue avec des indices (`hintsUsed` ignoré par BKT aujourd'hui) ?
2. **Réponse juste avec une idée fausse** : la compter comme juste ?
3. **Prestataire SMS / WhatsApp** (coût par message) et comptes développeur Google / Apple.
4. Validation des classes et unités du jeu d'exemple par Charles ou un enseignant béninois.

## 9. Défauts mineurs connus (reportés)

Lot 7 (après la relecture indépendante, points importants corrigés avec des tests) :
- relances préparées dans l'application seulement (pas encore d'envoi par WhatsApp, e-mail ou notification) ; pas d'heures calmes selon le fuseau de l'élève ;
- espacement des relances : 2 jours après la dernière activité, puis 4, 7 et 14 jours ; aucune tant que la précédente n'est pas lue ; 4 au plus sans activité ;
- le passage de suivi est un planificateur interne (un seul serveur, un passage à la fois, premier passage une minute après le démarrage) ; pg-boss quand il y en aura plusieurs ;
- le premier re-test espacé part de la confirmation de maîtrise (la réponse de reconfirmation, 72 h après, compte comme premier rappel) ;
- l'« activité » d'un élève compte aussi les déclarations faites par un adulte (préférences) : elles repoussent ses relances ; une séance avec le prof IA sans réponse soumise ne compte pas ;
- un élève sans aucun événement n'est jamais relancé (l'entretien lui est proposé seulement quand il ouvre l'application) ;
- la consigne de relance n'a pas encore de scénario dans `evals/` ; elle est en français (pas encore tirée de la langue du pays) ;
- `easy_win` et `spaced_review` sont des étiquettes : `planVariant` ne les exploite pas encore pour choisir la forme de l'exercice.

Lot 6 (après la relecture indépendante) :
- **besoins dys / TDAH : jamais repérés par l'IA** ; stockés à part, chiffrés et effaçables (fiche 0006) ; `WEMA_HEALTH_KEY` obligatoire en production ;
- la mesure automatique « réussit mieux avec des étapes guidées » est désactivée (comparaison biaisée) : à refaire avec une présentation tirée au hasard ;
- le texte d'adaptation propre à chaque besoin, envoyé au prof IA, permet de deviner le besoin : à mutualiser si besoin ;
- les mini-épreuves sous forme de jeu de l'entretien viendront avec le front-end ;
- la conversation de l'entretien et des séances (`tutor_messages`) est conservée sans durée limite : politique de conservation et purge réglementaire à définir ;
- le lot 6 n'a pas encore eu de relecture indépendante.

Lot 5 :
- le banc d'essai (`pnpm --filter @wema/api evals`) n'a pas encore tourné avec un vrai modèle : il faut la clé OpenRouter ;
- les événements `hint.requested`, `teachback.assessed`, `oralcheck.assessed` sont enregistrés mais pas encore pris en compte par le calcul du profil (lot 6) ;
- la limite d'échanges avec le prof IA est en mémoire (un seul serveur) ;
- pas d'audio (parole de l'élève, voix du prof IA).

Lot 4 :
- le routage par défaut utilise `anthropic/claude-haiku-5.5` (choix d'Olivier) : réglable (`PUT /api/admin/ai/routing`) ;
- pas encore de plafond de dépense par organisation ;
- essai réel : `pnpm --filter @wema/api ai:check` avec `OPENROUTER_API_KEY` dans `.env` ;
- relecture indépendante faite et corrigée (flux sans doublon, flux coupé détecté, sorties invalides non réessayées, masquage par contexte sans supposer de format national, journal non bloquant et par tentative, échéance globale, liste des modèles dans la passerelle) ;
- purge réglementaire : `ai_calls` (comme les autres journaux en ajout seul) référence `users` sans `ON DELETE` et refuse la suppression ; à traiter avec la procédure de purge des données d'un élève ;
- les messages d'erreur des fournisseurs sont recopiés dans `AiError.message` : ne jamais les renvoyer tels quels au client (prof IA, lot 5).

Lot 3 (après la relecture indépendante, dont les 2 points bloquants et les points importants sont corrigés avec des tests) :
- une réponse fausse n'est pas encore reliée à une idée fausse précise (`misconceptionId` à `null`) : il faudra l'analyse de la réponse (lot 5) ;
- les étapes guidées écrites par le prof ne sont pas vérifiées par le calcul (elles pourraient contenir la réponse) ;
- `hintsUsed` est déclaré par le client ; il sera fiable quand les indices viendront du prof IA (lot 5) ;
- une variante répondue après un changement de notion de son exercice est comptée pour la nouvelle notion ; un exercice archivé reste répondable sur les variantes déjà données ;
- `checkSteps` (contrôle d'étapes) existe dans `services/math` mais n'est pas encore utilisé par l'API ;
- la réponse brute de l'élève est conservée dans le journal (preuve pour le profil explicable) : texte libre, à couvrir par la politique de conservation ;
- `services/math` n'a pas d'authentification : à n'exposer que sur le réseau interne (fiche 0005) ;
- pas de devoirs datés ni d'échéances (lot 7) ; seul le format texte existe.

Lot 2 (après la relecture indépendante, dont les 4 points bloquants et 8 importants sont corrigés avec des tests dans `apps/api/src/security.test.ts`) :
- pas encore d'e-mail de vérification ni de mot de passe oublié ; pas de QR code de connexion élève ;
- l'inscription répond `email_taken` : elle révèle qu'un compte existe (à rendre neutre avec la vérification d'e-mail) ;
- une organisation ne peut pas rattacher un compte existant (seule l'équipe Wema le peut) : il faudra des **invitations** ;
- la limite d'échecs de connexion est en mémoire (un seul serveur) ; pas encore de limite par adresse IP ;
- l'import du jeu d'exemple échoue si une matière de même code a été créée à la main avant ;
- connexion Google / Apple testée avec un faux fournisseur seulement ; Apple ne marche qu'en HTTPS ;
- le journal d'audit n'est consultable que par l'équipe Wema (pas encore de journal par organisation).

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

## 10. Feuille de route (back-end d'abord, validée par Olivier le 1er novembre 2026)

| Lot                           | Contenu (logique et API)                                                                                                  | État     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| 2. Socle                      | comptes, connexion, organisations, rôles, référentiel en base, réglages, audit                                            | ✅       |
| 3. Exercices                  | variantes par élève vérifiées par `services/math`, banque hebdomadaire, correction qui alimente le profil                 | ✅       |
| **4. Passerelle IA**          | `@wema/ai-gateway` : interface commune, OpenRouter puis Vercel AI SDK, choix du modèle par tâche, journal des coûts       | prochain |
| 5. Prof IA                    | conversation par matière, indices progressifs sans donner la réponse, mode « explique-moi », vérification orale, `evals/` |          |
| 6. Profil vivant et entretien | hypothèses avec source, confiance et preuves, entretien initial, profil explicable                                        |          |
| 7. Suivi actif                | prochaine action, relances, re-tests espacés, tâches planifiées                                                           |          |
| 8. API des espaces            | élève, prof, parent, école : devoirs, résultats, suivi de classe                                                          |          |
| 9. Front-end                  | shadcn/ui et bibliothèques fournies par Olivier, sur l'API complète                                                       |          |

Avant chaque lot : un plan court validé par Olivier, puis `docs/plan/lot-XX-….md`.

## 11. Méthode de travail

- Les tests s'écrivent d'abord (TDD) : on voit chaque test échouer pour la bonne raison, puis passer.
- Un commit par tâche, en français, avec la ligne `Co-Authored-By` de l'agent.
- Avant chaque commit : `pnpm exec biome check --write .`, puis `pnpm lint`, `pnpm typecheck`, `pnpm test` et `pnpm check:boundaries`.
- À la fin d'un lot, une relecture indépendante de toute la branche. On corrige les points importants avec un test, et on liste les mineurs dans la PR et ici.
