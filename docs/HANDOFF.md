# Passation : reprendre le travail sur Wema

Ce document est écrit pour l'agent (ou la personne) qui reprend le projet sans avoir suivi les échanges précédents. Lisez-le en entier avant de toucher au code. Ensuite, lisez `AGENTS.md`, puis `docs/architecture.md`.

_Dernière mise à jour : 1er novembre 2026, fin du lot 1._

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

## 4. Où sont les choses

| Quoi                                 | Où                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Dépôt                                | `https://github.com/osessi/wema`                                         |
| Règles pour les agents               | `AGENTS.md` (source unique) ; `CLAUDE.md` l'importe                      |
| Architecture du cœur                 | `docs/architecture.md`                                                   |
| Vocabulaire français ↔ code          | `docs/glossaire.md`                                                      |
| Décisions d'architecture             | `docs/decisions/0001-socle-technique.md`, `0002-journal-evenements.md`   |
| Plans de lots                        | `docs/plan/` (lot 1 : `lot-01-fondations.md`)                            |
| Maquette (9 écrans, ancien nom Maïa) | `docs/reference/maquette/` ; ouvrir `Portail.dc.html` dans un navigateur |
| Document de cadrage (sept. 2026)     | `docs/reference/cadrage-2026-09.md`                                      |
| Contenu pédagogique                  | `content/curriculum/` (YAML)                                             |

Remarque : l'outil `claude_design` (DesignSync) n'a pas fonctionné depuis l'extension VS Code. La maquette a donc été exportée à la main dans `docs/reference/maquette/`. Ne la lisez pas en entier (environ 1 Mo) : ciblez l'écran utile.

## 5. Pile technique (décidée)

- Monorepo **pnpm 10 + Turborepo**, **TypeScript 7 strict** partout, **Biome** pour le lint et le format, **Vitest** pour les tests.
- **Node ≥ 22.18** : le script `check:boundaries` exécute du TypeScript directement.
- **Python** uniquement dans `services/math`, pour la vérification SymPy et, plus tard, l'ajustement des paramètres du profil. **Pas de Rust.**
- **Postgres** comme base unique, avec pgvector et la file de tâches pg-boss (à venir). Les tests utilisent **PGlite** (Postgres embarqué) : aucun Docker n'est nécessaire pour lancer les tests.
- Applis prévues : Next.js (web : élève, prof, parent) et Expo (mobile élève). Leurs squelettes **ne sont pas encore générés**.

## 6. Démarrer

```sh
git clone https://github.com/osessi/wema.git
cd wema
git checkout lot-01-fondations   # voir §7 : le lot 1 n'est pas encore fusionné dans main
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm check:boundaries
```

Attendu : tout passe, avec 36 tests (domain 5, curriculum 10, learner-model 13, db 7, api 1).

## 7. État actuel

### Branches et pull requests

- `main` contient le socle seul : arborescence, docs, `AGENTS.md`.
- **`lot-01-fondations`** contient tout le lot 1. Sa **pull request n°1** est ouverte, la CI est verte, elle n'est **pas fusionnée** : **Olivier n'a pas encore décidé de la fusion**. Demandez-lui avant de fusionner.
- La CI (`.github/workflows/ci.yml`) lance lint, typecheck, tests et le contrôle des dépendances à chaque PR vers `main`.

### Ce que fait chaque paquet

| Paquet                                                         | État     | Contenu                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@wema/domain`                                                 | ✅ lot 1 | identifiants marqués (UUID mis en minuscules), `Result`, `Notion`, `Misconception`, `CurriculumMapping`, `LearningEvent` (un seul type pour l'instant : `answer.submitted`), `parseLearningEvent` (Zod), `NotionStatus`                                                |
| `@wema/curriculum`                                             | ✅ lot 1 | `buildCurriculum` (validation : prérequis, cycles, doublons, pays ; toutes les erreurs listées), `loadCurriculum(dir)` (YAML, `.yaml` ou `.yml`, fichiers cachés ignorés)                                                                                              |
| `@wema/learner-model`                                          | ✅ lot 1 | `updateMastery` (BKT : pInit 0,2 · pLearn 0,15 · pSlip 0,1 · pGuess 0,2), `projectLearnerModel(learnerId, events)` (fonction pure, tri par date puis id), `notionStatus`                                                                                               |
| `@wema/db`                                                     | ✅ lot 1 | `SqlExecutor`, `fromPglite`, `migrate` (transactionnel, une seule fois par migration), `createEventStore` (`append` idempotent, `id_conflict` si le contenu diffère ; `listByLearner`). Table `learning_events` protégée contre UPDATE, DELETE et TRUNCATE par la base |
| `apps/api`                                                     | 🟡       | un seul test de bout en bout (`core-loop.test.ts`), pas encore de serveur                                                                                                                                                                                              |
| `@wema/exercises`, `tutor`, `orchestrator`, `ai-gateway`, `ui` | ⬜       | coquilles vides avec la description de leur rôle                                                                                                                                                                                                                       |
| `apps/web`, `apps/mobile`                                      | ⬜       | coquilles vides                                                                                                                                                                                                                                                        |
| `services/math`                                                | ⬜       | `pyproject.toml` seul                                                                                                                                                                                                                                                  |

### Règles pédagogiques en vigueur

- **Statuts :** `not_seen` (Non vue), `needs_work` (À travailler), `in_progress` (En cours, dès `pKnown ≥ 0,5`), `mastered` (Validé).
- **Validation :** `pKnown ≥ 0,95` **et** une bonne réponse au moins **72 h** après le passage du seuil. Si la maîtrise repasse sous 0,95, la reconfirmation est perdue.
- **Idée fausse :** elle est active dès qu'elle apparaît et redevient inactive après **2 bonnes réponses** sur la notion. Elle redevient active si elle réapparaît.

### Contenu

Il y a 4 notions de maths : `maths.calcul-litteral`, `maths.equations-1er-degre`, `maths.carres-racines` et `maths.pythagore`. Chacune a 2 ou 3 idées fausses et une correspondance `fr` et `bj`, **toutes en `verified: false`**.

## 8. Questions ouvertes à poser à Olivier

1. **Fusionner la PR n°1 ?**
2. **Classes et chapitres par pays :** à faire valider par Charles ou un enseignant béninois. Les numéros de chapitre sont à `null`.
3. **Seuils pédagogiques :** 72 h pour la reconfirmation, 2 réussites pour lever une idée fausse. Les garde-t-on ?
4. **Indices :** une bonne réponse obtenue avec des indices compte aujourd'hui comme une bonne réponse sans aide (`hintsUsed` n'est pas utilisé par BKT). Quel poids leur donner ?
5. **Réponse juste qui porte une idée fausse** (bon résultat, mauvais raisonnement) : aujourd'hui elle est comptée comme une bonne réponse, et l'idée fausse redevient active. Faut-il garder ce comportement ?
6. **Premier client du cœur :** les profs particuliers (Charles) ou les écoles ? Ça change la console prof.
7. **Besoins dys / TDAH :** les fait-on seulement déclarer au départ (plus simple et plus sûr juridiquement), ou ajoute-t-on aussi le repérage de signaux ? **Ce sont des données de santé de mineurs** (RGPD, art. 9). L'IA ne pose jamais de diagnostic.

## 9. Défauts mineurs connus (reportés)

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

## 10. Feuille de route proposée (à valider lot par lot avec Olivier)

| Lot                                | Contenu                                                                                                                                                                                                                                                                   | Dépend de       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **2. Exercices et vérification**   | `ExerciseIntent` et `ExerciseVariant` dans `domain`, exercices modèles dans `content/`, `services/math` (FastAPI + SymPy : vérifier une réponse et des étapes), `@wema/exercises` (déclinaison d'une intention en variantes, toute variante vérifiée avant d'être servie) | lot 1           |
| **3. Passerelle IA**               | `@wema/ai-gateway` : interface commune, routage par tâche (raisonnement ou économique), journal des coûts, fournisseur interchangeable                                                                                                                                    | lot 1           |
| **4. Prof IA et banc d'essai**     | `@wema/tutor` (questionnement, indices progressifs, mode « explique-moi », vérification orale), `evals/` (conversations types, critères, seuils bloquants)                                                                                                                | lots 2 et 3     |
| **5. Profil enrichi et entretien** | hypothèses avec preuves sur la façon d'apprendre, entretien initial, profil explicable                                                                                                                                                                                    | lots 1 et 4     |
| **6. Orchestrateur et suivi**      | prochaine action, relances, re-tests espacés, pg-boss                                                                                                                                                                                                                     | lots 4 et 5     |
| **7. Façades**                     | serveur `apps/api`, web Next.js (élève, console prof, parent), mobile Expo, design system `@wema/ui` d'après la maquette                                                                                                                                                  | lots précédents |
| **8. Tranche bêta**                | maths 3e, Charles et ses élèves, mesure de la progression                                                                                                                                                                                                                 | tout            |

Avant chaque lot : écrire `docs/plan/lot-XX-….md` (format du lot 1 : objectif, contraintes, points de vigilance, tâches en TDD), le **faire valider par Olivier**, puis l'exécuter sur une branche `lot-XX-…`. Terminer par une PR, une relecture indépendante et les corrections des points importants.

## 11. Méthode de travail utilisée au lot 1

- Les tests s'écrivent d'abord (TDD) : on voit chaque test échouer pour la bonne raison, puis passer.
- Un commit par tâche, en français, avec la ligne `Co-Authored-By` de l'agent.
- Avant chaque commit : `pnpm exec biome check --write .`, puis `pnpm lint`, `pnpm typecheck`, `pnpm test` et `pnpm check:boundaries`.
- À la fin d'un lot, une relecture indépendante de toute la branche. On corrige les points importants avec un test, et on liste les mineurs dans la PR et ici.
