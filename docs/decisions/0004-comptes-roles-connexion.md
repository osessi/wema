# 0004 · Comptes, organisations, rôles configurables et connexion

- **Date :** 2026-11-01
- **Statut :** accepté

## Contexte

Wema vise en parallèle les familles, les profs particuliers et les écoles. Une même application doit donc accueillir plusieurs clients séparés. Olivier veut des **rôles configurables** (on ajoute un rôle « ingénieur pédagogique » ou « coordinateur » sans développer), et plusieurs modes de connexion : e-mail et mot de passe, Google et Apple, téléphone (code par SMS ou WhatsApp). Un élève mineur peut avoir son propre identifiant, ou un compte créé par un parent ou une école.

## Décision

### Organisations

- Tout utilisateur appartient à une ou plusieurs **organisations** : une école, un réseau de profs, une famille, ou **Wema** elle-même (organisation de plateforme, unique).

### Permissions et rôles

- Les **permissions** forment un catalogue fermé, défini dans `@wema/domain` : ce sont les actions que le code sait vérifier (`curriculum.write`, `roles.manage`…). Ajouter une permission demande un développement.
- Les **rôles** sont des données : un nom et un ensemble de permissions, propres à une organisation. On les crée et les modifie dans le back-office.
- Une **appartenance** relie un utilisateur, une organisation et un rôle.
- Une permission a une **portée** : `organization` (n'agit que dans l'organisation) ou `platform` (agit sur tout Wema : référentiel, seuils pédagogiques, organisations). Une permission de portée `platform` n'est effective que si le rôle appartient à l'organisation Wema. Un prof qui doit éditer le référentiel reçoit donc un rôle dans l'organisation Wema.
- Le rôle système **« Super admin »** de Wema a toutes les permissions. On ne peut ni le vider, ni retirer le dernier compte qui le porte.

### Connexion

- Un **utilisateur** a une ou plusieurs **identités** : e-mail + mot de passe, téléphone, Google, Apple, ou identifiant élève + code.
- Les mots de passe sont hachés avec scrypt (`node:crypto`). Les jetons de session et les codes à usage unique ne sont stockés que sous forme d'empreinte.
- Les codes par téléphone ont 6 chiffres, expirent après 10 minutes et acceptent 5 essais. L'envoi passe par une interface `CodeSender` ; le prestataire réel (SMS, WhatsApp) sera choisi plus tard, selon le coût.
- Google et Apple passent par la bibliothèque `arctic`. Les secrets sont fournis par variables d'environnement.
- La session est un jeton opaque dans un cookie `httpOnly`, vérifié en base à chaque requête.
- Nous écrivons nous-mêmes cette couche, petite et testée, plutôt qu'une bibliothèque d'authentification complète : elle reste compatible avec notre accès SQL (sans ORM), avec PGlite dans les tests, et avec notre modèle de rôles.

### Où vit le code

- Nouveau paquet **`@wema/access`** (dépend de `domain`) : hachage, jetons, codes, évaluation des permissions. Ce sont des fonctions pures ou sans état, testées unitairement.
- `@wema/db` stocke comptes, rôles et audit. `apps/api` assemble et expose.

## Conséquences

- Une école, un réseau de profs ou une famille sont le même concept technique : la marque blanche et la console école se brancheront dessus.
- Ajouter un rôle ne demande pas de développement ; ajouter une **action** nouvelle, si.
- Nous portons la responsabilité de la sécurité de la connexion : tests systématiques, et relecture de sécurité avant la bêta.
- Les comptes d'élèves mineurs créés par un adulte n'ont ni e-mail ni téléphone : l'adulte qui les crée est tracé dans l'audit, et le consentement parental sera rattaché à ce moment-là (lot 5).
