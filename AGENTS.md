# AGENTS.md

Règles pour tout agent de code (Claude Code, Codex, etc.) qui travaille sur ce dépôt. Ce fichier est la source unique : `CLAUDE.md` l'importe.

## Le projet en bref

Wema donne à chaque élève un prof particulier IA par matière, qui individualise l'enseignement au plus fin. Le cœur du produit est un **modèle vivant de chaque élève**, qui décide quoi lui proposer et sous quelle forme. Avant tout changement important, lisez `docs/architecture.md`. Pour le vocabulaire, lisez `docs/glossaire.md`.

## Règles non négociables

1. **Le prof IA ne donne jamais la réponse finale** d'un exercice ou d'un devoir. Il questionne et donne des indices progressifs.
2. **Toute variante d'exercice mathématique est vérifiée par `services/math`** avant d'être servie à un élève. Ne faites jamais confiance au calcul d'un modèle d'IA.
3. **Le profil de l'élève n'est jamais écrit directement.** On ajoute des `LearningEvent` au journal, et le `LearnerModel` en est recalculé. Le journal ne sert qu'à ajouter : pas d'`UPDATE`, pas de `DELETE`, sauf purge réglementaire.
4. **Chaque hypothèse du profil a une source, une confiance et des preuves.** Pas d'affirmation sur un élève sans trace.
5. **Les appels aux modèles d'IA passent uniquement par `@wema/ai-gateway`.** Aucun SDK de fournisseur d'IA ailleurs.
6. **Rien n'est figé sur une matière ou un pays.** Les matières, les notions, les pays et les programmes viennent du référentiel (`content/curriculum/`), jamais d'un `if (subject === "maths")`.
7. **Données de mineurs et de santé :** pas de données personnelles réelles dans le code, les tests, les journaux de logs ou les jeux de données d'évaluation. Les besoins de type dys ou TDAH sont des données de santé : accès restreint, et jamais de diagnostic posé par l'IA.
8. **Tous les marchés sont traités à égalité.** Aucune hypothèse technique ou culturelle fondée sur un pays (connectivité, équipement, niveau…). Un choix se justifie par l'usage réel ou par une mesure.

## Architecture et dépendances

- `packages/` contient le cœur, `apps/` les façades, `services/math` le calcul en Python. Le détail est dans `docs/architecture.md`.
- Ordre des dépendances : `domain` ← `curriculum` ← `learner-model` ← `exercises` ← `tutor` ← `orchestrator`. `ai-gateway` et `db` ne dépendent que de `domain`.
- Une dépendance circulaire est interdite, tout comme une dépendance vers une brique située plus haut dans la chaîne. Si vous en avez besoin, l'abstraction est mal placée : déplacez le type vers `domain`.
- **Aucune logique pédagogique dans `apps/`.** Une app assemble et affiche, le cœur décide.
- Un nouveau paquet doit être justifié par une responsabilité distincte et documenté dans `docs/architecture.md`.

## Conventions

- **Langue :** le produit, l'interface, les docs et les messages de commit sont en français. Les identifiants de code et les noms de fichiers sont en anglais, selon `docs/glossaire.md`.
- **TypeScript strict.** Pas de `any`, pas de `as` pour faire taire le compilateur. Les erreurs attendues sont des valeurs typées ; les exceptions sont réservées aux bugs.
- **Formatage et lint :** Biome (`pnpm lint`, `pnpm format`). Python : ruff et pytest.
- **Tests :** toute règle pédagogique (calcul de maîtrise, choix de la prochaine action, déclinaison d'une variante) a ses tests unitaires. Toute modification des consignes du prof IA ou du routage s'accompagne de l'exécution des `evals/`.
- **Décisions :** un choix d'architecture durable fait l'objet d'une fiche dans `docs/decisions/` (numérotée, avec contexte, décision et conséquences).
- **Interface :** la référence visuelle est `docs/reference/maquette/` (charte, composants, parcours). Les composants partagés vivent dans `@wema/ui`.

## Commandes

```sh
pnpm install          # dépendances
pnpm typecheck        # vérification des types, tous paquets
pnpm lint             # Biome
pnpm test             # tests
pnpm dev              # applis en développement
docker compose -f infra/docker-compose.yml up -d   # Postgres local
```

## Méthode de travail

- Planifiez avant de coder : on travaille par lots décrits dans `docs/plan/`. Un lot égale une branche et une pull request, petite et relisible.
- Branches : `lot-XX-sujet` ou `fix/sujet`. Ne poussez jamais directement sur `main`.
- Avant de déclarer une tâche terminée : `pnpm typecheck`, `pnpm lint` et `pnpm test` passent. Signalez honnêtement ce qui n'a pas été vérifié.
