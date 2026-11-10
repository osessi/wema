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

**Import et export** (`transfer.ts`, `/admin/referentiel/<pays>`) : YAML au format de `content/curriculum/` (pays complet ou un programme) et CSV des notions. Un import est d'abord prévisualisé, puis recalculé et appliqué en une transaction ; il crée ce qui manque et met à jour les notions désignées par leur code (une notion dont le texte change repasse « à valider »), sans rien supprimer ni archiver. Le résultat complet est validé par `assembleCurriculum`. Les exercices s'importent en masse au format de `content/exercises/` ; seuls ceux que `services/math` accepte entrent, validés, dans la bibliothèque Wema.

**Programme proposé par l'IA** (`generate.ts`, routes `/api/admin/curriculum-generate`) : l'admin colle le texte officiel ou téléverse un PDF (texte extrait par `unpdf`, 10 Mo au plus, 60 000 caractères envoyés au plus), choisit classe et matière ; l'IA (tâche `curriculum.generate`, palier `reasoning`) propose unités et notions (code, nom, objectif, prérequis). Le document est encadré et traité comme une donnée, jamais comme une consigne. La proposition est validée par Zod puis contrôlée (codes uniques, prérequis connus, pas de cycle), relue et modifiée par l'admin, puis convertie en YAML et passée par l'import existant : les notions créées sont « à valider ».

**Rapport de progression d'un pilote** (`learner-model/src/report.ts`, routes `/api/reports/classes/:id` et `…/csv`, pages `/ecole/<org>/rapport` et `/prof/rapport`) : pour une classe et une période (3 derniers mois par défaut), le profil de chaque élève est recalculé depuis le journal au début et à la fin ; élèves actifs, notions validées, maîtrise moyenne des notions travaillées, statuts, notions les plus travaillées, idées fausses et leur évolution, temps d'activité (séances découpées par les pauses de plus de 30 min). Aucune estimation hors du journal. Version imprimable (CSS print) et export CSV.

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

**Banque de la semaine proposée par l'IA** (`proposeBankEntries`, `propose.ts`) :
- Pour chaque organisation, l'IA propose des intentions d'exercices sur les notions à travailler de ses classes et sur la prochaine notion du programme, avec au plus 3 propositions par notion et 12 par passage.
- Elle ne reçoit aucune donnée d'élève, seulement la notion, ses idées fausses et des effectifs.
- Chaque proposition est validée par Zod, puis vérifiée par `services/math`. Elle entre dans la banque avec la source « ai », et le prof la retient ou l'écarte.
- Le passage est fait une fois par semaine par organisation, et à la demande (`POST …/bank/generate`).

**Formats adaptés** (`presentation.ts`, `figures.ts`, `adapt.ts`, `numbers.ts` ; fiche `docs/decisions/0020-formats-adaptes.md`) : le format (texte, lecture facile, schéma, bande dessinée, audio) est choisi **au moment de servir** la variante, jamais à sa création : il ne change ni les nombres ni la réponse. `choosePresentation` pèse les hypothèses du profil (avec leur confiance), les adaptations d'un besoin déclaré et consenti, puis la **mesure** : le taux de réussite au premier essai par format (`answer.submitted.format`), dès 5 réponses dans le format et ailleurs. Le schéma vient d'un registre de gabarits de figure associés à des formes de tâche (`{p}*{v}+{q}={r}` → balance, `sqrt({a}**2+{b}**2)` → triangle rectangle…), jamais d'un test sur la matière. BD et lecture facile sont reformulées par l'IA (tâches `exercise.comics`, `exercise.simplify`), validées par Zod puis par `checkFaithful` (mêmes formules, mêmes nombres, aucun nombre ajouté, pas de réponse) ; sinon on garde le texte. Les reformulations sont gardées par variante (table `variant_renderings`, migration 0020). La balance et le triangle de Pythagore existent aussi en manipulables (web), comptés comme indices utilisés.

### 2.5 `tutor`, le prof IA en conversation

- Il ne donne jamais la réponse finale : il questionne, il donne des indices progressifs (niveaux 1 à 3). Quand la réponse attendue est connue, chaque réponse du prof IA est **contrôlée avant l'envoi** (`revealsAnswer`) : régénérée avec une consigne renforcée, puis remplacée par une relance sûre si besoin.
- Il ne reçoit aucune donnée personnelle : seulement l'état de l'élève sur la notion (maîtrise, idées fausses actives). Chaque matière peut avoir ses consignes propres, réglées par l'équipe Wema.
- Une réponse fausse est analysée pour repérer l'idée fausse probable (avec un seuil de confiance) ; « explique-moi » et la vérification orale se concluent par une évaluation ajoutée au journal, avec sa confiance et la séance comme preuve.
- **Prof IA personnalisé** (migration 0032, `tutor_personas`) : l'élève lui choisit un prénom (`isSafeTutorName` : lettres seulement, sans insulte ni santé) et un avatar dessiné, pour toutes ses matières ou une seule (`/api/learner/tutor-persona`). C'est un réglage d'affichage, hors du journal ; le prénom entre dans les consignes (« Tu t'appelles … ») sans changer aucune règle. Pas de métaphore hors sujet dans les indices, sauf un centre d'intérêt déclaré.
- **Notes libres du prof** (`teacher.noted`, routes `/api/admin/organizations/:id/learners/:userId/notes`) : écrites ou dictées, relues par les profs de la même organisation ; le prof IA reçoit les 3 plus récentes, citées comme des données, jamais comme des consignes. Une note qui évoque la santé est refusée (`health_note`) : les besoins passent par la déclaration avec consentement.
- **Encouragements** (`chooseEncouragement` dans `domain`) : un court message de l'interface après une réussite, une séance terminée ou 20 min de travail actif, au plus un par demi-heure ; ni points ni séries.
- **Mode « explique-moi » :** l'élève enseigne la notion, l'IA joue l'élève naïf et pose des questions.
- **Vérification orale :** « explique-moi en 30 secondes comment tu as trouvé ». Elle sert à la fois de preuve de compréhension et de parade à la triche.
- **Entretien initial :** une conversation orale avec mini-épreuves sous forme de jeu, complétée par un questionnaire parent et l'avis du prof. Il produit les premières hypothèses du profil.

- **Relecture d'une photo de copie** (`copy-review.ts`) : l'IA lit les étapes manuscrites et repère la première qui coince. Elle donne un indice, jamais la réponse.
  - Une étape qui donne un résultat n'est jamais déclarée juste par l'IA : seule la réponse saisie, vérifiée par `services/math`, fait foi.
  - L'événement `copy.reviewed` (source « paper ») ne compte pas pour la maîtrise. L'idée fausse qu'il porte alimente le profil.
  - La photo n'est jamais conservée.

### 2.6 `orchestrator`, le suivi actif

Pour chaque élève, il décide de la prochaine action, quel que soit le canal :
- séance sur une notion ;
- devoir adapté ;
- relance (« tu as fait l'exercice ? ») ;
- re-test espacé d'une notion validée ;
- séance raccourcie si la fatigue ou l'échec s'accumulent (une victoire facile après plusieurs échecs).

Il s'exécute sur un passage régulier (toutes les heures ; pg-boss quand il y aura plusieurs serveurs) et à la demande. Il tient compte des **devoirs** (une échéance proche passe en tête) et des **programmes suivis** par l'élève : ceux de ses classes et, pour les matières qu'aucune classe ne couvre, le **programme individuel** choisi par son parent (`effectivePrograms`, fiche `0010`) ; il en tire la prochaine notion nouvelle dont les prérequis sont validés. Un élève qui suit un programme individuel n'a pas de prof pour lui donner des exercices : `choosePersonalPractice` choisit, sur sa première action utile, un exercice validé (bibliothèque Wema, sa famille) et la façade en prépare une variante adaptée, vérifiée par services/math, une seule ouverte à la fois et seulement sur une matière ouverte (`apps/api/src/personal-practice.ts`, appelé par `GET /api/learner/next`).

**Envois** (`apps/api/src/notify/`, fiche `0017`) : l'orchestrateur prépare les relances, la façade les fait partir. Adaptateurs HTTP sans SDK (Twilio et Vonage pour le SMS et WhatsApp, Resend pour l'e-mail, console en développement), choisis par les variables d'environnement. Une tâche toutes les 5 minutes notifie les relances (à l'élève et à ses parents, chacun par son canal : application, e-mail, WhatsApp, SMS ou rien) et les nouveaux messages (regroupés : 10 min d'attente, au plus une notification par heure, jamais le contenu), puis envoie ce qui est dû hors des **heures calmes** du fuseau de la personne. Chaque envoi est au journal `notification_deliveries` (migration 0017) ; chaque message porte un lien de **désinscription signé** (en-têtes `List-Unsubscribe` pour l'e-mail). À un élève : tutoiement et aucun contenu commercial ; au parent : un texte fixe, sans détail sur l'élève. Les codes de connexion passent par les mêmes adaptateurs, sur le canal choisi. Préférences : `/compte/notifications` (routes `/api/notifications`). Canal « application » : la notification est aussi envoyée en **push** aux appareils de l'appli mobile (`push_tokens`), par l'API HTTP d'Expo (`notify/expo.ts`, sans compte ; `EXPO_ACCESS_TOKEN` facultatif), en respectant les heures calmes ; un ticket ou un reçu `DeviceNotRegistered` retire le jeton (reçus lus 15 min plus tard, table `push_receipts`). Les nouveaux messages sont notifiés en push à qui garde le canal « application » et a un appareil.

### 2.9 Classes, devoirs et liens familiaux

- Une **classe** (`SchoolClass`) regroupe des élèves et leurs profs dans une organisation, et se rattache à un programme du référentiel. Un prof ne pilote que les classes dont il est prof ; un membre retiré de l'organisation perd aussitôt l'accès.
- Un **devoir** donne un exercice validé à une classe avec une échéance : chaque élève reçoit sa variante, adaptée et vérifiée.
- Le **lien parent ↔ enfant** est explicite (dans une organisation famille), jamais déduit des rôles.
- **Famille autonome** (fiche `0010`, migration 0027) : un parent inscrit seul crée sa famille (`POST /api/family`, une seule par parent ; il y devient « Parent »), ajoute ses enfants (`POST /api/family/:id/children` : prénom, identifiant + code montré une fois ou e-mail, programme ; consentement parental enregistré, au plus 10 enfants) et choisit pour chacun un **programme individuel** dans le référentiel (pays × classe × matière, table `learner_programs`, un programme par matière, un seul pays ; `PUT …/children/:learnerId/programs`). Ce programme sert comme celui d'une classe : orchestrateur, `/learner/path`, banque de la semaine (`bankDemands`), exercices personnels ; la classe reste prioritaire pour sa matière. Toute organisation peut naître avec les **rôles par défaut** de son type (`DEFAULT_ROLES` dans `@wema/domain` : famille → Parent, Enfant ; école → Direction, Prof, Élève ; réseau → Responsable, Prof, Élève), modifiables ensuite ; le back-office et le parcours famille les demandent (`defaultRoles: true`).

- La **messagerie** relie un prof à ses élèves et aux parents de ses élèves, et un parent aux profs de son enfant. Un prof peut aussi envoyer des annonces à sa classe. Les droits sont recalculés à chaque envoi depuis les liens réels (classe, famille) : un élève ne peut écrire qu'à ses profs (`packages/db/src/message-store.ts`, routes `/api/messages`).

- Le **paiement** (fiche `0009`) est **par matière** : un abonnement relie un élève à une matière, payé par un parent. Les offres (pays, matière, devise, prix, période, essai, moyens de paiement) sont des données du back-office (`/admin/offres`, migration 0019), jamais du code. L'offre proposée et acceptée suit le **pays du programme** de l'enfant (classe ou programme individuel) ; sans programme, aucune offre (`program_required`). Le prof IA, les exercices personnalisés et le suivi d'une matière ne s'ouvrent que si l'élève a un abonnement payé, un essai en cours, ou appartient à une organisation **sous contrat** (écoles et réseaux de profs, facturés sur mesure) : contrôle côté API (`apps/api/src/billing/access.ts`), refus `402 subscription_required`. L'entretien initial reste gratuit. Stripe (carte, Checkout en abonnement) et Kkiapay (Mobile Money) sont des adaptateurs HTTP sans SDK dans `apps/api/src/billing/` (dossier de la façade, comme `notify/` : ce sont des intégrations externes, pas du cœur) ; les webhooks sont authentifiés (signature Stripe, secret Kkiapay puis vérification de la transaction auprès de Kkiapay) et un envoi rejoué n'est appliqué qu'une fois. Sans clé, en développement, un faux fournisseur simule un paiement réussi.

- L'**agenda** (fiche `0024`, migration 0024) : un prof (ou mentor) publie des **disponibilités récurrentes** dans son propre fuseau (« le mardi de 17 h à 19 h », une semaine sur N, avec bornes) ; elles sont développées à la lecture (`packages/db/src/agenda-time.ts`, fonctions pures testées : récurrence, fuseaux et changements d'heure, conflits). Le parent réserve un créneau libre auprès d'un prof de son enfant (un élève sans parent lié réserve lui-même) ; la séance est `requested`, le prof la confirme, la refuse ou propose un autre horaire (`proposed`, que la famille accepte). Le prof planifie aussi des séances, seul à seul ou avec un **groupe de révision** (élèves d'une ou plusieurs de ses classes, sur une notion). Un verrou par personne empêche deux réservations simultanées du même créneau. Les droits sont ceux de la messagerie (mêmes requêtes `ACTIVE_MEMBERS` / `VALID_GUARDIANSHIPS`), relus à chaque appel (`packages/db/src/agenda-store.ts`, routes `/api/agenda`). Chaque séance confirmée a sa salle **Jitsi Meet** au nom aléatoire (144 bits), sur `WEMA_JITSI_DOMAIN` (meet.jit.si par défaut), ouverte dans un onglet ; rien n'est enregistré. Après la séance, le **compte rendu** du prof (texte court, notions) est visible du parent et entre au journal comme un événement `session.reported` (source `teacher`), sans compter pour la maîtrise. Les **rappels** 24 h et 1 h avant sont préparés par `runAgendaReminders(db, sender, now)` (`apps/api/src/routes/agenda.ts`) : chaque rappel est réservé en base une seule fois, puis remis à un `AgendaReminderSender` (prof, élèves, parents, avec le lien de la page de séance de chacun). Ils passent par le module d'envoi (fiche `0025`, migration 0025) : `apps/api/src/notify/reminders.ts` met au journal une notification `session_reminder` par destinataire (colonnes `session_id`, `reminder`, `link_path`), par le canal choisi pour les **messages** (un seul réglage « messages et rappels »), dans la tâche « envois » des 5 minutes. Le rappel 24 h respecte les heures calmes ; le rappel 1 h passe outre. À l'envoi, la séance est relue : annulée, commencée ou à moins d'une heure (pour un rappel 24 h repoussé), la notification est annulée. La visio intégrée à la page (iframe) demande d'ajouter `frame-src https://<domaine>` à la CSP et le domaine à `camera`/`microphone`/`display-capture` dans `Permissions-Policy` (`apps/web/next.config.ts`), puis `WEMA_VISIO_EMBED=1`.

### 2.7 `ai-gateway`, la porte unique vers l'IA

- Une interface commune, quel que soit le fournisseur : le modèle est interchangeable.
- Le routage se fait **par tâche** : un modèle de raisonnement pour expliquer et corriger, un modèle économique pour les relances et les check-ins.
- Chaque appel est journalisé : tâche, modèle, coût, latence, élève concerné.
- Aucun autre paquet n'appelle un fournisseur d'IA directement.
- Deux branchements interchangeables, capables des mêmes choses : **OpenRouter** (HTTP direct) et **Vercel AI SDK**. Le routage (fournisseur actif, modèles par palier `reasoning` / `economic` ou par tâche) est un réglage modifiable par l'équipe Wema.
- Données des mineurs : chaque appel exige des fournisseurs sans collecte ni conservation (`data_collection: "deny"`, `zdr: true`), et les e-mails et numéros sont masqués avant l'envoi.
- **Plafonds de dépense** (`budget.ts`, `/admin/couts`) : un plafond mensuel global et un par organisation, avec un seuil d'alerte. Au-delà, la passerelle refuse les tâches non essentielles (`budget_exceeded`, journalisé) ; les tâches essentielles (prof IA, analyse de réponse, entretien, copie) ne sont jamais bloquées. Le tableau de bord donne le coût par jour, tâche, modèle, organisation, élève actif et matière (matière : estimation au prorata des événements de l'élève dans la journée).

### 2.8 `access`, comptes et permissions

- Hachage des mots de passe, jetons de session, codes à usage unique (téléphone).
- Évaluation des permissions : catalogue fermé de permissions (dans `domain`), rôles configurables par organisation, portée `organization` ou `platform`.
- Aucune logique pédagogique. Voir la fiche `docs/decisions/0004-comptes-roles-connexion.md`.

## 3. Le journal d'événements

Toute interaction produit un événement **ajouté, jamais modifié**. Exemples : réponse à un exercice, indice demandé, photo analysée, explication donnée en mode « explique-moi », séance abandonnée.

Ce journal sert à trois choses :
1. **Recalculer le profil** à tout moment, y compris quand on change d'algorithme.
2. **Apprendre** quels formats et quelles stratégies marchent, pour quel profil et quelle idée fausse. On le fait d'abord par élève, puis sur l'ensemble des élèves de façon anonymisée.

**Apprentissage collectif anonymisé** (`packages/db/src/collective*.ts`, fiche 0021) : chaque nuit, des agrégats par notion sont calculés sur tous les élèves de toutes les organisations : idées fausses les plus fréquentes, réussite à la réponse suivante selon le format et l'exercice (bibliothèque Wema seulement), part d'élèves bloqués, réponses avant la première réussite, temps avec le prof IA. Aucun identifiant n'est stocké, et un groupe de moins de 10 élèves n'est jamais publié (k-anonymat, seuil plancher). Ils servent à l'équipe Wema (`/admin/collectif`), au prof (« ce qui marche ailleurs », carte de la classe) et au cœur : `planVariant` guide un élève « en cours » quand les étapes guidées font nettement mieux progresser sur la notion.
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

**Tests de bout en bout (`e2e/`).** Un paquet à part, `@wema/e2e`, joue les parcours de chaque rôle dans un vrai navigateur (Playwright), sur l'API, le web et `services/math` réels, avec leur propre base (`wema_e2e`, recréée à chaque exécution) et leurs propres ports (API 4100, web 3100), sans IA réelle. Il ne dépend d'aucune brique : il passe par l'interface et l'API, comme un utilisateur. Voir `docs/tests-e2e.md`.

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

**Appli mobile élève** (`apps/mobile`, guide `docs/mobile.md`) : Expo SDK 58, Expo Router, mêmes routes d'API que le web, types des réponses déduits de `AppType` (client `hono/client`). Aucune logique pédagogique : elle affiche et envoie. La session n'est pas un cookie : à la connexion, l'en-tête `x-wema-client: mobile` fait renvoyer le jeton de session dans la réponse ; l'appli le garde dans le coffre du téléphone (expo-secure-store) et l'envoie en `Authorization: Bearer`. Une requête à jeton ignore tout cookie, ce qui permet de l'exempter du contrôle d'origine sans rouvrir la porte au CSRF (`apps/api/src/http.ts`). Les jetons push Expo sont enregistrés par `POST /api/me/push-tokens` (table `push_tokens`, migration 0023) ; l'envoi se branche sur le canal « app » du module de notifications.

**Formulaire de contact du site public** (`apps/api/src/routes/contact.ts`, migration 0028) : `POST /api/contact`, sans session, avec le contrôle d'origine des écritures, une limite de 5 demandes par heure et par adresse IP (en mémoire, comme les autres limites) et un champ piège (`website`) qui fait répondre 200 sans rien enregistrer. La table `contact_requests` ne garde qu'une empreinte HMAC de l'IP (`ip_hash`), jamais l'adresse. L'équipe est prévenue par e-mail (Resend) si `WEMA_CONTACT_EMAIL` est renseignée, et lit les demandes dans le back-office (`/admin/contacts`, routes `/api/admin/contact-requests`, permission de plateforme `contacts.manage`).

**Mise en production** (fiche 0007, guide `docs/deploiement.md`) : un serveur avec Docker, `infra/docker-compose.prod.yml` (Postgres, `services/math`, API, web, Caddy en frontal HTTPS, sauvegarde quotidienne `pg_dump` avec rotation, restauration par `infra/restore.sh`). Images : `apps/api/Dockerfile` (tsx), `apps/web/Dockerfile` (Next « standalone »), `services/math/Dockerfile` (uv) ; la CI les construit sans les pousser. Les tâches périodiques (suivi actif, envois, banque hebdomadaire) passent par `apps/api/src/scheduler.ts` : **pg-boss** dès qu'il y a un Postgres (rythmes cron en base, un seul passage à la fois pour tous les serveurs), minuteries du processus avec PGlite. En production, `config.ts` refuse de démarrer sans `DATABASE_URL`, `WEMA_CODE_SECRET` (32 caractères au moins), `WEMA_HEALTH_KEY` et une `WEMA_PUBLIC_URL` en https ; le web envoie les en-têtes de sécurité (CSP, HSTS…).

## 7. Données sensibles

- Les élèves sont **mineurs**. Le consentement parental est requis.
- Les besoins de type dys, TDAH, etc. sont des **données de santé** (RGPD, art. 9) : consentement explicite, accès restreint, chiffrement, hébergement adapté. Wema **ne pose pas de diagnostic** : elle adapte selon des besoins déclarés et peut suggérer de consulter un professionnel.
- Les photos de copies et les enregistrements audio ont une durée de conservation définie et sont supprimés automatiquement.
- Les données des élèves ne servent jamais à entraîner un modèle d'un fournisseur tiers.
- **RGPD (fiche 0008)** : « Mon compte » (`/compte`) permet d'exporter ses données en JSON (et celles de son enfant pour un parent) et de demander la suppression du compte, effective après un délai de grâce. La purge réglementaire (`purgeUser` dans `@wema/db`) est la seule à pouvoir supprimer des lignes des journaux en ajout seul, par un réglage local à sa transaction ; elle laisse une ligne `users` anonyme. Une tâche quotidienne applique les durées de conservation réglées dans le back-office. Le consentement parental et l'acceptation des conditions (versionnées) sont enregistrés ; les pages légales sont publiques.

## 8. Ce qui n'est pas dans le cœur

Le cœur ne contient ni facturation, ni marque blanche, ni intégrations (Pronote…), ni visio mentor, ni groupes de révision. Ces fonctions se branchent sur les mêmes paquets. Depuis le 1er novembre 2026, on développe l'application par **tranches complètes** (cœur, serveur et écrans à chaque lot) : voir `docs/plan/`.

## 9. Première tranche à prouver

On fait tourner le cycle complet sur un périmètre fin : maths de 3e (France et Bénin), 2 à 3 chapitres, un prof et ses élèves, avec trois interfaces (élève, prof, parent). Le plan détaillé, lot par lot, sera dans `docs/plan/`.
