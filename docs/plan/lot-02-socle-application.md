# Lot 2 · Socle de l'application : plan d'implémentation

**Objectif :** à la fin du lot, on se connecte au **back-office web** de Wema et on y construit soi-même un référentiel (pays, classes, matières, programmes, unités, notions, idées fausses), on crée des rôles configurables, des organisations et des comptes, et on règle les seuils pédagogiques. C'est la première tranche complète : cœur, base, serveur et écrans.

**Décisions d'Olivier qui cadrent ce lot (1er novembre 2026) :**
- on travaille par **tranches complètes** : chaque lot livre le cœur et des écrans utilisables ;
- le référentiel est **géré dans l'application** par le super admin (et les rôles qu'il autorise), et non plus par des fichiers ;
- hiérarchie : pays → classe → matière → programme → unité → notion. **Les notions sont propres à chaque pays.** Le nom de l'unité (« situation d'apprentissage », « chapitre », « module »…) est choisi pour chaque pays ;
- **rôles configurables** : on ajoute des rôles au besoin (ingénieur pédagogique, coordinateur…) ;
- connexion par **e-mail et mot de passe**, **Google / Apple**, et **téléphone (code par SMS ou WhatsApp)**. Un élève peut avoir son propre identifiant comme un adulte, **ou** un compte créé par un parent ou une école (identifiant + code) ;
- interface en **français, prête pour d'autres langues** : aucun texte en dur dans les composants ;
- **seuils pédagogiques réglables** sans toucher au code.

**Architecture :** voir les fiches `docs/decisions/0003-referentiel-en-base.md` et `0004-comptes-roles-connexion.md`.

**Pile :** Hono (serveur `apps/api`), Next.js 16 (back-office dans `apps/web`), next-intl (textes), `pg` (Postgres en production), PGlite (tests), `arctic` (Google / Apple), `node:crypto` (mots de passe, jetons, codes).

**Branche :** `lot-02-socle-application`. Commits locaux par tâche ; poussée sur GitHub quand Olivier le demande.

## Contraintes globales

- Règles de `AGENTS.md`, en particulier : pas de `any`, erreurs attendues en `Result`, aucune matière ni aucun pays en dur, aucune donnée personnelle réelle dans les tests.
- **Aucune logique pédagogique dans les apps.** Les règles (validation du référentiel, cycles de prérequis, calcul de maîtrise, évaluation des permissions) vivent dans les paquets et ont leurs tests.
- Toute action d'administration (référentiel, rôles, membres, réglages) est **tracée** dans un journal d'audit en ajout seul : qui, quoi, quand.
- Rien n'est supprimé physiquement dans le référentiel : une notion utilisée par des événements est **archivée**.
- Chaque tâche se termine par `pnpm lint`, `pnpm typecheck`, `pnpm test` et `pnpm check:boundaries` au vert, puis un commit.

## Points de vigilance

1. **Verrouillage.** On ne peut pas retirer le dernier super admin, ni vider le rôle système « Super admin » de ses permissions. _(Tests : tâche 6.)_
2. **Permissions de plateforme.** Les permissions qui touchent tout le monde (référentiel, seuils, organisations) ne sont effectives que si le rôle appartient à l'organisation Wema. Un admin d'école ne modifie pas le programme national. _(Tests : tâche 4.)_
3. **Cycles et frontières de pays.** Un prérequis ne peut pas créer de cycle, ni pointer vers une notion d'un autre pays. _(Tests : tâche 3.)_
4. **Sécurité de connexion.** Mots de passe hachés (scrypt), jetons de session et codes stockés hachés, codes à usage unique avec expiration et nombre d'essais limité, réponses identiques que le compte existe ou non. _(Tests : tâches 4 et 6.)_
5. **Seuils incohérents.** Un réglage où le seuil « En cours » dépasse le seuil « Validé », ou une probabilité hors de ]0, 1[, est refusé. _(Tests : tâche 5.)_
6. **Données de mineurs.** Aucun code de connexion ni numéro de téléphone dans les logs, sauf l'envoyeur de développement explicitement local.

---

### Tâche 1 : fiches de décision et documentation

- `docs/decisions/0003-referentiel-en-base.md` et `0004-comptes-roles-connexion.md`.
- Mettre à jour `docs/architecture.md` (§2.2 référentiel, nouveau paquet `access`, §5 dépendances, §8) et `docs/glossaire.md`.
- Corriger les défauts connus utiles maintenant : `engines.node >=22.18`, `types: ["node"]` retiré de la base et ajouté paquet par paquet.

### Tâche 2 : domaine

- Identifiants : `CountryId`, `GradeId`, `SubjectId`, `ProgramId`, `UnitId`, `NotionId`, `MisconceptionId`, `UserId`, `OrganizationId`, `RoleId`.
- Référentiel : `Country` (code, nom, libellés de l'unité au singulier et au pluriel), `Grade` (classe, rang), `Subject`, `Program` (pays × classe × matière), `Unit`, `Notion` (code unique dans le pays, prérequis, idées fausses, `verified`, archivage), `Misconception`.
- Permissions : catalogue fermé `PERMISSIONS` (identifiant + portée `platform` ou `organization`), type `Permission`.
- Tests : catalogue sans doublon, constructeurs d'identifiants.

### Tâche 3 : référentiel (`@wema/curriculum`)

- `assembleCurriculum(rows)` : construit le référentiel d'un pays à partir des lignes de la base et le valide (toutes les erreurs accumulées).
- `checkPrerequisiteChange(curriculum, notionId, prerequisites)` : refuse un cycle, un prérequis inconnu ou d'un autre pays.
- Import du jeu d'exemple : nouveau format `content/curriculum/<pays>/` (pays, classes, programmes, unités, notions), lu par `loadCurriculumSeed(dir)`. Les 4 notions de maths deviennent un exemple pour la France et le Bénin.
- Tests : cycles, frontières de pays, codes en double, import du jeu d'exemple.

### Tâche 4 : comptes et permissions (`@wema/access`, nouveau paquet, dépend de `domain`)

- `hashPassword` / `verifyPassword` (scrypt, sel aléatoire, comparaison en temps constant), règles minimales de mot de passe.
- `createSessionToken` / `hashToken` (jeton aléatoire, seule l'empreinte SHA-256 est stockée).
- `createOneTimeCode` / `verifyOneTimeCode` (6 chiffres, 10 minutes, 5 essais).
- `effectivePermissions(memberships)` et `can(...)` : union des permissions des rôles ; les permissions de portée `platform` ne comptent que dans l'organisation Wema.
- Interface `CodeSender` (SMS, WhatsApp) et envoyeur de développement.
- Tests de chaque fonction.

### Tâche 5 : seuils réglables (`@wema/learner-model`)

- `LearnerModelSettings` : paramètres BKT, seuil « En cours », seuil « Validé », délai de reconfirmation (heures), réussites pour lever une idée fausse. Les valeurs actuelles deviennent `DEFAULT_SETTINGS`.
- `parseLearnerModelSettings(input)` avec les contrôles de cohérence.
- `projectLearnerModel` prend ces réglages en paramètre. Les tests existants restent verts.

### Tâche 6 : base de données (`@wema/db`)

- `SqlExecutor.transaction(fn)` et adaptateur `fromPgPool` (`pg`) ; `migrate` passe par `transaction` et prend un verrou consultatif.
- Migrations : organisations, utilisateurs, identités (e-mail, téléphone, Google, Apple, identifiant élève), sessions, codes à usage unique, rôles, appartenances, référentiel (pays, classes, matières, programmes, unités, notions, prérequis, idées fausses), réglages pédagogiques, journal d'audit (ajout seul).
- Dépôts : `accounts`, `roles`, `curriculum`, `settings`, `audit`.
- Amorçage : organisation Wema + rôle système « Super admin » + premier compte super admin (via variables d'environnement, jamais en dur).
- Tests sur PGlite, dont le verrouillage du dernier super admin.

### Tâche 7 : serveur (`apps/api`)

- Hono, démarrage avec `@hono/node-server`, configuration par variables d'environnement validées.
- Connexion : inscription et connexion par e-mail, code par téléphone, Google et Apple (`arctic`), connexion élève par identifiant + code, déconnexion, `GET /me`. Session dans un cookie `httpOnly`.
- Administration : référentiel (lecture et écriture), matières, organisations, rôles, membres (dont création d'un compte élève géré), réglages pédagogiques, journal d'audit. Chaque route vérifie sa permission ; chaque écriture est tracée.
- Client typé exporté pour le web (`hono/client`).
- Tests de bout en bout sur PGlite : un super admin construit un programme ; un rôle sans `curriculum.write` reçoit 403 ; le dernier super admin ne peut pas être retiré.

### Tâche 8 : design system (`@wema/ui`)

- Jetons de la charte de la maquette (bleu nuit `#14325C`, bleu `#2F6FB5`, orange `#E58A3C`, bordures `#DCE4EE`, fonds `#F6F9FD` / `#EDF3FA`, texte `#161616` / `#6E6E6E`, police Poppins).
- Composants de base : bouton, champ, sélecteur, case à cocher, carte, tableau, badge, barre latérale, en-tête de page, état vide, message d'erreur.

### Tâche 9 : back-office (`apps/web`)

- Next.js 16 (App Router), next-intl (`messages/fr.json`), appels au serveur par le client typé, redirection `/api/*` vers `apps/api`.
- Écrans : connexion (e-mail, téléphone, Google, Apple, élève) ; référentiel (pays → classes et programmes → unités et notions → fiche notion avec prérequis et idées fausses) ; matières ; organisations ; rôles (cases à cocher des permissions) ; membres ; réglages pédagogiques ; journal d'audit.
- Les menus n'affichent que ce que les permissions de l'utilisateur autorisent.

### Tâche 10 : vérification et passation

- Test de bout en bout du cycle du lot 1 adapté (référentiel en base).
- Lancement réel : `apps/api` + `apps/web` + Postgres, parcours manuel du back-office.
- Mise à jour de `docs/HANDOFF.md`.

## Hors de ce lot (prévu plus tard)

- Envoi réel de SMS / WhatsApp (choix du prestataire et coût à décider), QR code de connexion élève, invitations par e-mail.
- Espaces élève, prof, parent, école (lots 3 à 7) ; modèles de rôles par type d'organisation.
- Limitation du nombre de tentatives de connexion par adresse IP.
