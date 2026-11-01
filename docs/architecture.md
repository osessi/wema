# Architecture de Wema

Wema donne à chaque élève un prof particulier IA par matière. Ce qui fait la valeur du produit, ce n'est pas le modèle d'IA, c'est le **cœur d'individualisation** : un modèle vivant de chaque élève qui décide quoi lui proposer, sous quelle forme, et qui s'améliore avec les résultats.

Les applications (app élève, web, console prof, vue parent, messagerie) sont de simples façades sur ce cœur.

## 1. Le cycle central

```
Entretien initial ──► Profil de l'élève (jumeau pédagogique)
                              │
   ┌──────────────────────────┘
   ▼
Banque hebdomadaire par notion (proposée par l'IA)
   │
   ▼
Le prof sélectionne, modifie ou dépose ses propres exercices
   │
   ▼
Variantes par élève : même intention, rendu et difficulté adaptés
   │      (vérifiées par services/math avant d'être servies)
   ▼
L'élève travaille (app, web, papier photographié, messagerie)
   │
   ▼
Suivi : relances, questions, mode « explique-moi », vérification orale
   │
   ▼
Événements d'apprentissage ──► le profil est recalculé ──► (retour au début)
```

Le « prof » peut être un enseignant d'école, un prof particulier, un coach, ou l'équipe de suivi Wema elle-même. Le cœur ne fait pas de différence : c'est un **rôle**, pas un type de client.

## 2. Les briques du cœur

### 2.1 `domain`, le vocabulaire commun

Il contient les types et invariants partagés et ne dépend de rien. Si un concept pédagogique existe, il est défini ici et nulle part ailleurs.

### 2.2 `curriculum`, le référentiel

- **Hiérarchie** : pays → classe → programme (classe × matière) → unité → notion. Les matières sont communes ; tout le reste appartient à un pays, **y compris les notions**. Le nom des unités (« situation d'apprentissage », « chapitre »…) est choisi pour chaque pays.
- **Prérequis** sous forme de graphe orienté, à l'intérieur d'un pays. Il sert à remonter à la vraie cause d'un blocage. Pas de cycle.
- **Idées fausses** propres à chaque notion. Exemple : « un nombre change de signe en changeant de côté ». C'est ce qui rend un devoir réellement personnel.

Le référentiel est **géré dans l'application** (back-office) par le super admin et les rôles qu'il autorise, stocké dans Postgres, et tracé dans le journal d'audit. Rien n'est supprimé physiquement : on archive. `content/curriculum/` n'est plus qu'un jeu d'exemple importable. Voir la fiche `docs/decisions/0003-referentiel-en-base.md`.

### 2.3 `learner-model`, le jumeau pédagogique

| Couche            | Contenu                                                                                                         | Origine                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Savoirs           | probabilité de maîtrise par notion, date du dernier rappel                                                      | réponses de l'élève                   |
| Erreurs           | idées fausses actives, avec preuves                                                                             | réponses, copies photographiées       |
| Façon d'apprendre | besoins déclarés (dys, TDAH…), formats qui marchent (schéma, BD, audio, intérêts), rythme, attention, confiance | entretien, parent, prof, puis mesures |
| Contexte          | progression de la classe, emploi du temps, objectifs                                                            | prof, élève, intégrations             |

**Règle fondatrice :** chaque affirmation du profil est une **hypothèse** qui a une source, un niveau de confiance et des preuves. « Comprend mieux avec des schémas » est d'abord déclaré, puis confirmé ou infirmé par la mesure (taux de réussite avec et sans schéma). C'est ce qui produit le **profil explicable** montré au parent et au prof.

Le profil n'est **jamais modifié directement**. Il est recalculé à partir du journal d'événements (voir §3).

### 2.4 `exercises`, séparer le fond de la forme

Un exercice se compose de deux choses :
- **Une intention** fixe : notion, compétence visée, idée fausse ciblée, réponse attendue, étapes de résolution, niveau.
- **Un rendu**, propre à chaque élève : formulation (phrases courtes, police adaptée), découpage en étapes, format (texte, BD, audio, manipulable interactif), contexte tiré de ses intérêts, niveau d'indices.

Le même exercice déposé par le prof devient donc N variantes **sans changer ce qu'il évalue**.

**Garde-fou obligatoire :** toute variante mathématique est vérifiée par `services/math` (SymPy) avant d'être servie. Un exercice faux n'atteint jamais un élève. TypeScript choisit les paramètres et la forme ; Python calcule (fiche `docs/decisions/0005-services-math.md`).

**Forme choisie selon le profil** (`planVariant`) : niveau des nombres, découpage en étapes et indices dépendent de la maîtrise de l'élève sur la notion et de ses idées fausses actives. **Seul le premier essai** sur une variante entre dans le journal ; les essais suivants (limités) servent à se corriger. Une réponse illisible n'est ni une erreur ni un essai.

### 2.5 `tutor`, le prof IA en conversation

- Il ne donne jamais la réponse finale : il questionne, il donne des indices progressifs.
- **Mode « explique-moi » :** l'élève enseigne la notion, l'IA joue l'élève naïf et pose des questions.
- **Vérification orale :** « explique-moi en 30 secondes comment tu as trouvé ». Elle sert à la fois de preuve de compréhension et de parade à la triche.
- **Entretien initial :** une conversation orale avec mini-épreuves sous forme de jeu, complétée par un questionnaire parent et l'avis du prof. Il produit les premières hypothèses du profil.

### 2.6 `orchestrator`, le suivi actif

Pour chaque élève, il décide de la prochaine action, quel que soit le canal :
- séance sur une notion ;
- devoir adapté ;
- relance (« tu as fait l'exercice ? ») ;
- re-test espacé d'une notion validée ;
- séance raccourcie si la fatigue ou l'échec s'accumulent (une victoire facile après plusieurs échecs).

Il s'exécute sur des tâches planifiées (pg-boss) et sur des événements.

### 2.7 `ai-gateway`, la porte unique vers l'IA

- Une interface commune, quel que soit le fournisseur : le modèle est interchangeable.
- Le routage se fait **par tâche** : un modèle de raisonnement pour expliquer et corriger, un modèle économique pour les relances et les check-ins.
- Chaque appel est journalisé : tâche, modèle, coût, latence, élève concerné.
- Aucun autre paquet n'appelle un fournisseur d'IA directement.
- Deux branchements interchangeables, capables des mêmes choses : **OpenRouter** (HTTP direct) et **Vercel AI SDK**. Le routage (fournisseur actif, modèles par palier `reasoning` / `economic` ou par tâche) est un réglage modifiable par l'équipe Wema.
- Données des mineurs : chaque appel exige des fournisseurs sans collecte ni conservation (`data_collection: "deny"`, `zdr: true`), et les e-mails et numéros sont masqués avant l'envoi.

### 2.8 `access`, comptes et permissions

- Hachage des mots de passe, jetons de session, codes à usage unique (téléphone).
- Évaluation des permissions : catalogue fermé de permissions (dans `domain`), rôles configurables par organisation, portée `organization` ou `platform`.
- Aucune logique pédagogique. Voir la fiche `docs/decisions/0004-comptes-roles-connexion.md`.

## 3. Le journal d'événements

Toute interaction produit un événement **ajouté, jamais modifié**. Exemples : réponse à un exercice, indice demandé, photo analysée, explication donnée en mode « explique-moi », séance abandonnée.

Ce journal sert à trois choses :
1. **Recalculer le profil** à tout moment, y compris quand on change d'algorithme.
2. **Apprendre** quels formats et quelles stratégies marchent, pour quel profil et quelle idée fausse. On le fait d'abord par élève, puis sur l'ensemble des élèves de façon anonymisée.
3. **Auditer et expliquer** chaque décision prise pour un élève.

« Un système qui apprend » veut dire que c'est le profil et la stratégie pédagogique qui s'améliorent à partir de ce journal. On ne ré-entraîne pas un modèle d'IA.

## 4. Qualité : le banc d'essai (`evals/`)

Toute modification des consignes du prof IA, du routage ou d'un modèle rejoue un jeu de conversations types. Les critères sont automatiques, complétés par une relecture humaine sur échantillon :
- aucune réponse finale donnée ;
- mathématiques exactes ;
- une question de relance par tour ;
- ton adapté à l'âge et au profil ;
- respect des adaptations (dys, TDAH…).

Une régression bloque la mise en production.

## 5. Dépendances entre paquets

```
domain ◄── curriculum ◄── learner-model ◄── exercises ◄── tutor ◄── orchestrator
   ▲                                          │            │
   └────────────── ai-gateway ◄───────────────┴────────────┘
   ▲
   ├── db
   └── access

apps/* ──► assemblent les paquets ; aucune logique pédagogique dans les apps
```

Une flèche va d'un paquet vers ce dont il dépend. Il n'y a pas de dépendance circulaire, et une brique ne dépend jamais d'une brique située plus à droite. Ces dépendances sont déclarées dans les `package.json`. À automatiser : un contrôle qui fait échouer la CI si une règle est violée.

## 6. Pile technique

| Besoin              | Choix                                     | Raison                                                                                                                                                                 |
| ------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Langage produit     | TypeScript partout (web, mobile, serveur) | une seule langue, code partagé entre web et mobile                                                                                                                     |
| Web                 | Next.js                                   | élève web, console prof, vue parent                                                                                                                                    |
| Mobile              | Expo (React Native)                       | app élève iOS et Android                                                                                                                                               |
| Serveur             | Node.js, TypeScript                       | API, webhooks, tâches                                                                                                                                                  |
| Calcul mathématique | Python + SymPy (`services/math`)          | vérification fiable des exercices ; plus tard, ajustement des paramètres du modèle de l'élève (le calcul de maîtrise lui-même est en TypeScript, dans `learner-model`) |
| Base de données     | Postgres (+ pgvector)                     | une seule base : données, journal, file de tâches                                                                                                                      |
| File de tâches      | pg-boss                                   | relances et tâches planifiées, sans Redis                                                                                                                              |
| Outils              | pnpm, Turborepo, Biome                    | monorepo rapide, un seul outil de lint et de format                                                                                                                    |

Pas de Rust : ce qui limite la vitesse, c'est la latence de l'IA, pas le calcul.

## 7. Données sensibles

- Les élèves sont **mineurs**. Le consentement parental est requis.
- Les besoins de type dys, TDAH, etc. sont des **données de santé** (RGPD, art. 9) : consentement explicite, accès restreint, chiffrement, hébergement adapté. Wema **ne pose pas de diagnostic** : elle adapte selon des besoins déclarés et peut suggérer de consulter un professionnel.
- Les photos de copies et les enregistrements audio ont une durée de conservation définie et sont supprimés automatiquement.
- Les données des élèves ne servent jamais à entraîner un modèle d'un fournisseur tiers.

## 8. Ce qui n'est pas dans le cœur

Le cœur ne contient ni facturation, ni marque blanche, ni intégrations (Pronote…), ni visio mentor, ni groupes de révision. Ces fonctions se branchent sur les mêmes paquets. Depuis le 1er novembre 2026, on développe l'application par **tranches complètes** (cœur, serveur et écrans à chaque lot) : voir `docs/plan/`.

## 9. Première tranche à prouver

On fait tourner le cycle complet sur un périmètre fin : maths de 3e (France et Bénin), 2 à 3 chapitres, un prof et ses élèves, avec trois interfaces (élève, prof, parent). Le plan détaillé, lot par lot, sera dans `docs/plan/`.
