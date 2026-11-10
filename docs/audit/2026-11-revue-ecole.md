# Revue de l'espace école (novembre 2026)

- **Compte :** `direction@wema.test` (Awa Direction, Collège démo `89880e13-…`), en production, le 10 novembre 2026.
- **Méthode :** navigation en lecture seule avec un script Playwright, à 1440 x 900 et à 390 x 844.
  - Aucun formulaire n'a été envoyé et aucun rôle n'a été modifié : les menus ont seulement été ouverts.
  - Aucune requête autre que GET n'a été émise.
- **Captures :** `/private/tmp/claude-501/-Users-olivierkakpo-dev-Projet-de-prof-particulier-IA/6fb95da0-1112-4cce-aaac-04134c293912/scratchpad/audit/ecole/`, abrégé `ecole/…` ci-dessous.
- **Espace prof :** les pages communes (compte, messagerie, agenda) et l'espace prof, que la direction peut aussi ouvrir, sont détaillés dans `2026-11-revue-prof.md`. Le bug de mise en page B1 de ce rapport vaut ici aussi.

## 1. Pages visitées

| Route                                                            | Ce qu'on y fait                                                                                                                                 | Capture                                                                             |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `/ecole`                                                         | Choix de l'organisation. Avec une seule école, renvoi direct vers sa page                                                                       | `ecole/racine-*.png`                                                                |
| `/ecole/[orgId]`                                                 | Tableau de bord : 4 chiffres clés, graphique « Progression par classe », table « Détail des classes »                                           | `ecole/tdb-*.png`                                                                   |
| `/ecole/[orgId]/classes`                                         | Liste des classes et formulaire « Créer une classe »                                                                                            | `ecole/classes-*.png`                                                               |
| `/ecole/[orgId]/classes/[classId]`                               | Profs et élèves de la classe, « Inscrire un membre », carte de la classe (par notion, par élève)                                                | `ecole/classe-*.png`                                                                |
| `/ecole/[orgId]/membres`                                         | Consentement parental manquant, table des membres, ajout d'un membre (e-mail, téléphone, identifiant élève), rôles et permissions, nouveau rôle | `ecole/membres-*.png`, `ecole/i-membres-tel.png`, `ecole/i-membres-identifiant.png` |
| Menus de la page Membres                                         | Menu « Ajouter un rôle » (+) et liste « Rôle »                                                                                                  | `ecole/i-membres-ajout-role.png`, `ecole/i-membres-select-role.png`                 |
| `/ecole/[orgId]/journal`                                         | Journal d'audit de l'organisation                                                                                                               | `ecole/journal-*.png`                                                               |
| Sélecteur d'espace et menu utilisateur                           | Changer d'espace (Prof, École)                                                                                                                  | `ecole/i-espace-switch.png`, `ecole/i-user-menu.png`                                |
| `/compte`, `/compte/notifications`                               | Pages communes                                                                                                                                  | `ecole/compte-*.png`, `ecole/notifs-*.png`                                          |
| `/prof`, `/prof/agenda`, `/prof/messages` (vus par la direction) | Espace prof accessible par le sélecteur d'espace                                                                                                | `ecole/prof-home-*.png`, `ecole/agenda-*.png`, `ecole/messages-prof-*.png`          |
| `/ecole/0000…`                                                   | 404 propre                                                                                                                                      | `ecole/org-404-*.png`                                                               |

Constats valables pour toutes ces pages :
- aucune erreur de console ;
- aucune requête en 4xx ou 5xx, hors 404 voulue ;
- aucun défilement horizontal aux deux largeurs ;
- aucun chargement infini.

**Ce qui n'existe pas dans l'espace école, et n'a donc pas pu être revu :**
- **Facturation sur contrat :**
  - aucune page côté école ;
  - le contrat ne se règle que dans le back-office super admin (`apps/web/src/app/admin/offres/contract-switch.tsx`, `PUT /admin/billing/contracts/:orgId`) ;
  - la seule trace visible pour l'école est une ligne brute `organization.contract` dans le journal (voir B1).
- **Invitations :**
  - pas de flux d'invitation : « Ajouter un membre » crée directement le compte (e-mail ou téléphone avec mot de passe facultatif, ou identifiant élève) ;
  - pas de lien ni d'e-mail d'invitation, pas de liste d'invitations en attente, pas de relance ;
  - pas de dialogue dédié : c'est un formulaire en ligne dans la page.
- **Messagerie et agenda :** absents du menu de l'espace école (`apps/web/src/app/ecole/layout.tsx`). La direction n'y accède qu'en passant dans l'espace « Prof ».

## 2. Erreurs et bugs

### Bloquant

**B1. Actions brutes non traduites dans le journal**
- **Constat :** quatre codes s'affichent tels quels sur `/ecole/[orgId]/journal` : `bank.propose`, `bank.selected`, `bank.rejected` et `organization.contract`. Sur 53 lignes, environ la moitié sont des `bank.propose` (`ecole/journal-desktop.png`).
- **Cause :**
  - `apps/web/src/app/ecole/[orgId]/journal/page.tsx:57-59` retombe sur `e.action` quand `t.has("actions.…")` est faux ;
  - il manque dans `apps/web/messages/fr/school.json` (bloc `school.audit.actions`, ligne 177 et suivantes) les clés `bank.propose`, `bank.selected` et `bank.rejected`, ainsi que `organization.contract` (le bloc `organization` ne contient que `create`) ;
  - ces actions sont écrites par `apps/api/src/routes/exercises.ts:378` et `:750`, et par l'écriture du contrat.
- **Correctif :**
  - ajouter les libellés, par exemple « Exercice proposé à la banque », « Exercice retenu », « Exercice écarté », « Contrat modifié » ;
  - ajouter un test qui vérifie que toute action écrite par l'API a sa traduction.

### Gênant

- **G1. Retrait d'un rôle en un clic, sans confirmation.**
  - **Constat :** sur `/membres`, la croix d'une pastille de rôle appelle directement `DELETE …/members/:id/roles/:roleId` (`apps/web/src/components/school/members-table.tsx:80-90`).
  - **Risque :** retirer le seul rôle « Prof » d'un enseignant lui coupe l'accès par mégarde. La cible fait 12 px, juste à côté du nom du rôle.
  - **Correctif :** une confirmation (AlertDialog) ou une annulation possible pendant 5 s (toast).
- **G2. Retrait d'un membre d'une classe en un clic, sans confirmation.** Le bouton × de `/ecole/[orgId]/classes/[classId]` appelle directement `DELETE /admin/classes/:id/members/:userId` (`apps/web/src/components/school/class-members.tsx:55-62`). Même correctif.
- **G3. Rôle « Élève » par défaut dans « Ajouter un membre »**, y compris en mode e-mail (`ecole/membres-desktop.png`). Si la direction ajoute un prof sans changer le rôle, elle crée un compte élève. Il faut un rôle obligatoire sans valeur par défaut, ou un défaut selon le mode : « Identifiant élève » donne Élève, « E-mail » ne présélectionne rien.
- **G4. Programme présélectionné au hasard dans « Créer une classe ».** Le champ affiche « Bénin · 5e · Mathématiques » (le premier de la liste), alors que la seule classe existante suit « France · 4e » (`ecole/classes-desktop.png`). Il faut un « Choisir un programme » obligatoire, ou proposer le programme le plus utilisé de l'établissement.
- **G5. Colonne « Actions » vide pour presque toute la table des membres.** Seuls les comptes à identifiant élève y ont un bouton (« Nouveau code »). Pour les autres, l'en-tête annonce des actions qui n'existent pas : pas de désactivation, pas de retrait de l'établissement, pas de renvoi d'accès (`members-table.tsx:132-160`).
- **G6. Rôles impossibles à modifier ou supprimer dans l'interface.**
  - **Constat :** `roles-panel.tsx` ne fait qu'une création (une seule mutation, ligne 44), alors que le journal prévoit « Rôle modifié » et « Rôle supprimé ».
  - **Conséquence :** une coquille dans un nom de rôle reste définitive.
- **G7. Journal limité aux 200 dernières entrées**, sans pagination ni filtre (`apps/api/src/routes/organizations.ts:501-504`, `limit: 200`). La page fait déjà 2243 px de haut avec 53 lignes. De plus, chaque ligne ne dit pas **sur quoi** porte l'action : quel exercice, quel membre, quelle classe.
- **G8. Inscrire la direction comme élève est possible.**
  - **Constat :** dans « Inscrire un membre » (fiche de classe), la liste propose « Awa Direction · Direction » avec « En tant que : Élève » par défaut.
  - **Proposition :** filtrer selon le rôle choisi (n'afficher que les élèves pour « Élève »), et choisir le rôle avant le membre.

### Cosmétique

- **C1. Graphique « Progression par classe » décalé.** Avec 0 % de notions validées, la barre « mastered » est invisible : la seule barre visible (actifs, 100 %) occupe la moitié droite, décentrée sous l'étiquette (`ecole/tdb-desktop.png`). Son vert foncé (`--chart-3`) ne figure nulle part ailleurs dans l'application. Il faudrait des barres horizontales par classe, avec des valeurs écrites.
- **C2. Cartes de la liste des classes presque vides.** Elles ne montrent que le nom et le programme, sans nombre d'élèves, sans prof et sans activité (`ecole/classes-desktop.png`).
- **C3. Pas de fil d'Ariane sur la fiche de classe.** Seul un bouton « Toutes les classes » en haut à droite permet de revenir. La page de classe du prof, elle, en a un.
- **C4. Carte « par élève » sans repères.** Dans la fiche de classe (`ecole/classe-desktop.png`), les 13 pastilles par élève n'ont ni étiquette ni regroupement visible. Il y a bien un `title` au survol (`components/school/class-map.tsx:127`), mais rien sur mobile.
- **C5. Table des membres sur mobile.** La colonne « Actions » sort du cadre, et il faut faire défiler la table pour la voir (`ecole/membres-mobile.png`).
- **C6. Encadré « Consentement parental manquant » sans action ni mise en valeur.** Il a l'aspect d'une carte neutre. Il faudrait un ton d'alerte et un bouton (« Envoyer le lien au parent », « Imprimer les codes »).

## 3. Problèmes d'UX et propositions

1. **Tableau de bord trop pauvre pour une direction.**
   - **Constat :** quatre chiffres et une table d'une ligne. Rien sur les profs (qui donne des devoirs, qui se connecte), rien sur les élèves à risque, rien sur les tendances.
   - **Proposition :**
     - courbes d'activité sur 8 semaines ;
     - « élèves inactifs depuis 7 jours » ;
     - « devoirs donnés cette semaine par prof » ;
     - un lien vers chaque classe ;
     - un sélecteur de période.
2. **Membres : une seule page longue mêle trois tâches** (liste, ajout, rôles).
   - **Proposition :**
     - la liste en `DataTable`, avec recherche, filtre par rôle, tri, pagination et import CSV ;
     - « Ajouter un membre » et « Inviter » dans un **dialogue** ouvert depuis un bouton principal ;
     - les rôles dans un onglet ou une page séparée.
3. **Flux d'invitation à créer.**
   - **Proposition :**
     - un dialogue « Inviter » (e-mail, téléphone ou WhatsApp, rôle, classes) qui envoie un lien ;
     - une liste « Invitations en attente » avec relance et annulation ;
     - pour les élèves sans téléphone, un lot de fiches de connexion imprimables (identifiant et code), sur la base de `LoginCode`.
4. **Rôles et droits.**
   - **Constat :** les permissions s'affichent en pastilles en vrac, et le formulaire « Nouveau rôle » est une grille de 10 cases sans regroupement.
   - **Proposition :**
     - une **matrice rôles × permissions**, groupée par domaine (Référentiel, Exercices, Élèves, Santé, Administration) ;
     - une description par permission ;
     - un avertissement visible sur « Voir les besoins particuliers partagés » (données de santé) ;
     - la modification et la suppression d'un rôle, en indiquant le nombre de membres concernés.
5. **Sélecteur de rôle d'un membre.** Le bouton « + » s'ouvre sur un menu sans description (`ecole/i-membres-ajout-role.png`). Mieux vaut un `Popover` avec des cases à cocher, la description de chaque rôle et une confirmation pour les rôles sensibles (Direction).
6. **Classes.**
   - **Constat :** pas de modification du nom ni du programme, pas d'archivage, pas d'inscription en masse (un seul élève à la fois avec deux listes déroulantes).
   - **Proposition :**
     - un dialogue « Inscrire des élèves » avec recherche et sélection multiple ;
     - un import CSV ;
     - l'affectation du prof principal ;
     - l'archivage en fin d'année.
7. **Facturation sur contrat.**
   - **Constat :** l'école ne voit rien de son contrat.
   - **Proposition :** une page « Abonnement » en lecture seule, avec :
     - le statut du contrat (« Sous contrat avec Wema, toutes les matières incluses ») ;
     - la période ;
     - le nombre d'élèves couverts ;
     - un contact Wema.
8. **Journal.**
   - **Proposition :**
     - filtres par acteur, type d'action et période ;
     - pagination ;
     - libellé lisible avec la cible (« Mme Prof Démo a retenu _Résoudre ax = c_ ») ;
     - regroupement des actions système répétées (« Système : 8 exercices proposés à la banque ») ;
     - export CSV.
9. **Messagerie et agenda pour la direction.** Ajouter « Messages » au menu École, au moins pour écrire aux profs et aux parents, ou ouvrir clairement le passage vers l'espace Prof. Aujourd'hui, la direction voit un espace « Prof » qui dit « Vous n'êtes prof d'aucune classe » (`ecole/prof-home-desktop.png`), ce qui est déroutant.

## 4. Refonte visuelle, page par page

Comme pour le prof, l'espace est en shadcn standard : cartes blanches, boutons noirs, icônes grises fines. Il faut le rapprocher du site (`tk-frame`, étiquettes Geist Mono majuscules, `GlowTile`, jaune `#FFC529`, papier grainé, titres légers), comme `connexion/auth-card.tsx`.

- **Barre latérale :**
  - une pastille d'icône `GlowTile` par rubrique : Vue d'ensemble en jaune (jauge), Classes en bleu, Membres en violet, Journal en gris chaud ;
  - le nom de l'établissement dans un en-tête avec une étiquette mono « ÉCOLE · COLLÈGE DÉMO » ;
  - la future rubrique Abonnement en vert (sceau).
- **Tableau de bord :**
  - **Chiffres clés :** grands chiffres Geist légers, étiquettes en mono majuscule (« CLASSES », « ÉLÈVES INSCRITS »), un `GlowTile` par carte, un petit graphique d'évolution sous chaque chiffre, et un compteur qui s'anime de 0 à la valeur au premier affichage.
  - **Graphique :** passer aux couleurs du site (jaune pour les actifs, encre pour les notions validées), avec des barres arrondies à 6 px, horizontales s'il y a plus de 4 classes.
  - **Détail des classes :** un `DataTable` avec un en-tête mono, des lignes cliquables et des mini-barres de progression.
- **Classes :**
  - des tuiles de classe en `tk-frame` arrondi doux, avec le drapeau ou l'étiquette du programme en mono, le nombre d'élèves, des avatars de profs empilés et un anneau de progression ;
  - « Créer une classe » dans un dialogue lancé par un bouton jaune.
- **Fiche de classe :**
  - un fil d'Ariane ;
  - des listes Profs et Élèves avec avatars à initiales, et le × remplacé par un menu « … » ;
  - carte par notion : barres segmentées par état (non vue, à travailler, en cours, validé) plutôt qu'une simple barre ;
  - carte par élève : remplacer les points par la carte de chaleur commune à l'espace prof.
- **Membres :**
  - avatars, rôles en pastilles colorées par rôle (Direction en jaune, Prof en bleu, Élève en vert) ;
  - type de connexion avec une icône (e-mail, téléphone, Google, Apple) ;
  - matrice des rôles sur fond grainé ;
  - encadré de consentement en ton d'alerte (ambre) avec une icône bouclier animée.
- **Journal :** une chronologie verticale groupée par jour, avec un séparateur de date en mono majuscule, une icône colorée par famille d'action et les noms d'acteur en gras.
- **Animations :**
  - apparition des titres en fondu mot à mot ;
  - cartes en fondu et translation de 4 px en cascade de 30 ms ;
  - dialogues en scale de 0,98 à 1 ;
  - désactivées si `prefers-reduced-motion`.

## 5. Composants nécessaires pour l'espace école

| Besoin                                                                         | Existe dans `packages/ui`                                     | À créer ou compléter                                                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Tableau de données (tri, filtres, pagination, recherche, import et export CSV) | `table.tsx` seulement                                         | `DataTable` (TanStack Table), avec bascule en cartes sur mobile et `min-w-0` sur le conteneur (voir B1 du rapport prof) |
| Chiffres clés                                                                  | Non. Il existe `components/school/stat.tsx`, très simple      | `StatTile` : étiquette mono, `GlowTile`, petit graphique d'évolution, compteur animé                                    |
| Graphiques                                                                     | `chart.tsx` et `recharts.tsx` existent                        | Thème de couleurs du site (jaune, encre, gris chaud), barres horizontales, courbes d'activité                           |
| Carte de chaleur des notions                                                   | Non                                                           | `MasteryHeatmap`, partagé avec le prof                                                                                  |
| Barre segmentée par état                                                       | Non                                                           | `StatusStackBar` (non vue, à travailler, en cours, validé)                                                              |
| Dialogue d'invitation                                                          | `dialog.tsx` existe                                           | `InviteDialog` : canaux, rôle, classes, aperçu du message                                                               |
| Liste des invitations                                                          | Non                                                           | Liste avec statut, relance et annulation                                                                                |
| Sélecteur de rôles                                                             | `dropdown-menu.tsx`, `popover.tsx` et `checkbox.tsx` existent | `RolePicker` (Popover, cases à cocher, description de chaque rôle) et `RoleBadge` coloré                                |
| Matrice rôles × permissions                                                    | Non                                                           | `PermissionMatrix`, groupée par domaine, avec un marqueur « données de santé »                                          |
| Confirmation d'action destructrice                                             | Non. Ni `alert-dialog` ni toast d'annulation                  | `ConfirmDialog` (AlertDialog Radix), et une annulation via `sonner` (déjà présent)                                      |
| Sélection multiple de membres                                                  | `command.tsx` existe                                          | `MemberMultiPicker`, avec recherche et avatars                                                                          |
| Import de fichier                                                              | Non                                                           | `FileDrop` (CSV de membres)                                                                                             |
| Chronologie (journal)                                                          | Non                                                           | `Timeline`, groupée par jour                                                                                            |
| Avatar                                                                         | `avatar.tsx` existe                                           | Pile d'avatars (`AvatarStack`)                                                                                          |
| Pastille d'icône en couleur et cadre biseauté                                  | Non. Ils n'existent que dans `apps/site/src/wa`               | Porter `GlowTile`, les icônes animées et `Frame` (`tk-frame`) dans `packages/ui`                                        |
| Fiches de connexion imprimables                                                | `components/school/login-code.tsx` (une seule)                | Planche imprimable en lot                                                                                               |
| États vides                                                                    | Non                                                           | `EmptyState`                                                                                                            |
