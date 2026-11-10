# Revue de l'espace prof (novembre 2026)

- **Compte :** `prof@wema.test`, en production (https://wema.winneragency.co/app), le 10 novembre 2026.
- **Méthode :** navigation en lecture seule avec un script Playwright, à 1440 x 900 et à 390 x 844, avec la locale fr-FR et le fuseau Africa/Porto-Novo.
  - Aucune requête autre que GET n'a été envoyée, à une exception près : l'aperçu de variante, qui ne s'enregistre pas (`POST …/exercises/:id/preview`, vérifié dans `apps/api/src/routes/exercises.ts`).
  - Le bouton « Demander des propositions à l'IA » n'a pas été cliqué, car il écrit en base.
- **Captures :** `/private/tmp/claude-501/-Users-olivierkakpo-dev-Projet-de-prof-particulier-IA/6fb95da0-1112-4cce-aaac-04134c293912/scratchpad/audit/prof/`. Elles sont abrégées `prof/…` ci-dessous ; les noms en `-desktop` et `-mobile` désignent le même écran aux deux largeurs.

## 1. Pages visitées

| Route                                                                              | Ce qu'on y fait                                                                                                    | Capture                                                                                                      |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `/prof`                                                                            | Accueil : cartes de classe et résumé de la banque de la semaine                                                    | `prof/home-*.png`                                                                                            |
| `/prof/banque?org=…` (semaines du 2, du 9 et du 16 nov.)                           | Tri des propositions de l'IA : Retenir, Écarter, Aperçu, Déposer                                                   | `prof/banque-*.png`, `prof/banque-prev-*.png`, `prof/i-banque-semaine-suiv.png`, `prof/i-banque-retenus.png` |
| Dialogue « Déposer un exercice »                                                   | Choisir un exercice validé à mettre dans la banque                                                                 | `prof/i-banque-deposer.png`                                                                                  |
| Dialogue « Aperçu d'une variante »                                                 | Niveaux 1 à 3, étapes guidées, formats Texte, Schéma, Lecture facile et Bande dessinée                             | `prof/i-banque-apercu.png`                                                                                   |
| `/prof/exercices` (onglets Tous, Brouillons, Validés, Archivés, Bibliothèque Wema) | Bibliothèque d'exercices                                                                                           | `prof/exercices-*.png`, `prof/i-exos-brouillons.png`, `prof/i-exos-wema.png`                                 |
| `/prof/exercices/[id]`                                                             | Fiche et édition d'un exercice (notion, calcul SymPy, énoncé)                                                      | `prof/exo-*.png`, `prof/i-exo-detail.png`                                                                    |
| `/prof/exercices/nouveau`                                                          | Création d'un exercice (dépôt)                                                                                     | `prof/nouveau-*.png`, `prof/i-exo-nouveau.png`                                                               |
| `/prof/classes/[id]` (onglet Carte)                                                | Constellation des notions, détail d'une notion, idées fausses, « ce qui marche ailleurs », grille élèves × notions | `prof/classe-*.png`, `prof/i-classe-notion.png`                                                              |
| `/prof/classes/[id]?tab=learners`                                                  | Tableau des élèves                                                                                                 | `prof/classe-eleves-*.png`                                                                                   |
| `/prof/classes/[id]?tab=assignments` et dialogue « Donner un devoir »              | Devoirs : taux de rendu, réussites, variantes                                                                      | `prof/classe-devoirs-*.png`, `prof/i-classe-donner-devoir.png`                                               |
| `/prof/eleves/[orgId]/[userId]`                                                    | Fiche élève : progression par notion, préférences, observation, besoins déclarés                                   | `prof/eleve-*.png`                                                                                           |
| `/prof/agenda` (vues Semaine, Mois et Année)                                       | Agenda, disponibilités, groupes                                                                                    | `prof/agenda-*.png`, `prof/i-agenda-semaine.png`, `prof/i-agenda-mois.png`, `prof/i-agenda-annee.png`        |
| Dialogues de l'agenda                                                              | « Planifier une séance » (clic sur un créneau), « Ajouter une disponibilité », « Nouveau groupe »                  | `prof/i-agenda-slot.png`, `prof/i-agenda-dispo.png`, `prof/i-agenda-groupe.png`                              |
| `/prof/agenda` avec un navigateur en anglais                                       | Contrôle du format des dates                                                                                       | `prof/i-agenda-en-US.png`                                                                                    |
| `/prof/agenda/seances/[id]`                                                        | Séance en visio (Jitsi). Le compte de démo n'a aucune séance : seul le cas 404 a été vu                            | `prof/seance-404-*.png`                                                                                      |
| `/prof/messages` et dialogue « Nouveau message »                                   | Messagerie (aucune conversation dans la démo)                                                                      | `prof/messages-*.png`, `prof/i-messages-nouveau.png`                                                         |
| `/compte`, `/compte/notifications`, `/compte/conditions`                           | Compte, préférences d'envoi, acceptation des conditions                                                            | `prof/compte-*.png`, `prof/notifs-*.png`, `prof/conditions-*.png`                                            |
| Identifiants inconnus                                                              | Pages 404 : classe, élève, séance                                                                                  | `prof/classe-404-*.png`, `prof/eleve-404-*.png`                                                              |

Constats valables pour toutes ces pages :
- aucune erreur de console, sauf les 404 voulues ;
- aucune requête en 4xx ou 5xx ;
- aucun chargement infini ;
- toutes les pages ont répondu en 2 à 3,5 s.

## 2. Erreurs et bugs

### Bloquant

**B1. Débordement horizontal de la page de classe, onglet « Carte » (bug déjà connu, cause trouvée)**
- **Mesures :** le document fait 1696 px pour 1440 px de fenêtre, 1856 pour 1600, et 2076 pour 1920. L'excès vaut toujours **256 px**, soit la largeur de la barre latérale (16 rem).
- **Où :** seulement sur l'onglet Carte. Les onglets Élèves et Devoirs ne débordent pas.
- **Pour reproduire :** ouvrir `/prof/classes/1614e44b-…` à n'importe quelle largeur de bureau.
- **Cause :**
  - `<main data-slot="sidebar-inset">` est un élément flex de la rangée « barre latérale + contenu ». Sa classe est `relative flex w-full flex-1 flex-col` (`packages/ui/src/components/ui/sidebar.tsx:311`). Il n'a pas de `min-w-0`, donc sa largeur minimale vaut `auto`, c'est-à-dire la largeur min-content de son contenu.
  - L'onglet Carte contient deux blocs très larges :
    - la grille « Élèves × notions » (`apps/web/src/components/teacher/class-map.tsx:242-285`) : 13 colonnes en `min-w-32` font une table de 1754 px ;
    - la constellation, dont la largeur est fixée en pixels (`class-map.tsx:86-97` : `style={{ width }}`, ici 1050 px).
  - Les conteneurs `overflow-x-auto` qui les entourent (dans `Table` de `packages/ui`, et `rounded-xl border` de la constellation) ne servent à rien : leur min-content reste celui de leur contenu.
  - Résultat : `main` ne descend pas sous 100 % de la fenêtre et se fait pousser à droite de la largeur de la barre latérale.
- **Vérification :** avec `main.style.minWidth = "0"` injecté dans la page, le défilement disparaît aux trois largeurs. `main` passe à 1176, 1336 et 1656 px, et la table défile dans son propre cadre.
- **Correctif :** ajouter `min-w-0` à `SidebarInset` (`sidebar.tsx:311`), ou passer `className="min-w-0"` à `<SidebarInset>` dans `apps/web/src/components/shell/app-shell.tsx:252`.
- **Même cause ailleurs :**
  - fiche élève à 390 px : 447 px pour 390 (la table « Progression par notion » sort de l'écran) ;
  - `/prof/exercices/[id]` à 390 px : 485 px pour 390. Les déclencheurs `Select` des idées fausses ne se replient pas ; il faut aussi `min-w-0` et `truncate` sur le `SelectTrigger`.

**B2. Gabarits bruts `{expression}`, `{equation}`, `{a}`, `{b}`… dans la banque et la bibliothèque (bug déjà connu, cause trouvée)**
- **Où :**
  - toutes les cartes de `/prof/banque` (« Résous l'équation {equation}. », « Calcule {expression}. ») ;
  - toutes les lignes de `/prof/exercices`, onglet Wema compris (`{a}`, `{b}`, `{c}`, `{t}`, `{p}`, `{r}`, `{h}`, `{d}`) ;
  - le champ « Énoncé » des fiches exercice.
- **Cause :**
  - L'interface affiche `x.statement` tel quel :
    - `apps/web/src/components/teacher/bank-board.tsx:350` ;
    - `apps/web/src/components/teacher/exercise-library.tsx:102`.
  - Ce champ est le **modèle d'énoncé** de l'intention d'exercice. Il n'est rempli qu'au moment de tirer une variante, par `renderTemplate(intent.statement, parameters, rendered)` dans `packages/exercises/src/generate.ts:80-84`.
  - La page de la banque charge les intentions par `organizationExercises()` (`apps/web/src/app/prof/banque/page.tsx:47-55`), sans aucune variante d'exemple.
  - La preuve que le rendu fonctionne : le dialogue « Aperçu » appelle `/preview` et affiche bien « Résous l'équation 2x = 28. » (`prof/i-banque-apercu.png`).
- **Correctif :** au choix.
  - (a) L'API de la banque et de la bibliothèque renvoie un `sampleStatement`, rendu avec une graine fixe et mis en cache.
  - (b) Côté interface, remplacer chaque `{…}` par une pastille stylée (« a », « équation ») avec une infobulle « tiré pour chaque élève ». C'est une solution d'attente.
  - Dans le formulaire d'édition, garder le modèle brut, puisque c'est voulu (`teacher.json:273-274`).

### Gênant

- **G1. Dates de l'agenda dans la langue du navigateur, pas dans celle de l'application.**
  - **Constat :** avec un navigateur en anglais, le titre de période affiche « 9 – November 15, 2026 » au milieu d'une interface en français (`prof/i-agenda-en-US.png`).
  - **Cause :** `toLocaleDateString(undefined, …)` dans :
    - `apps/web/src/components/agenda/calendar.tsx:47,51,59` ;
    - `views.tsx:227,324,396,422` ;
    - `local-time.tsx:21,28` ;
    - `family-agenda.tsx:201,274,278,312,325`.
  - **Correctif :** utiliser `useFormatter()` de next-intl, ou passer la locale de l'application.
- **G2. Champs natifs de date et d'heure au format américain (observé, à vérifier sur un vrai poste).** Dans « Donner un devoir », le champ échéance affiche « 11/17/2026, 06:00 PM ». Dans « Ajouter une disponibilité », on lit « 05:00 PM » et « mm/dd/yyyy » (`prof/i-classe-donner-devoir.png`, `prof/i-agenda-dispo.png`). Ces champs suivent la langue d'interface du navigateur, pas l'attribut `lang` de la page. Il faut un sélecteur de date et d'heure maison, en français.
- **G3. L'onglet de classe n'est pas gardé dans l'URL.** `ClassTabs` utilise `defaultValue` sans `onValueChange` vers `?tab=` (`apps/web/src/components/teacher/class-tabs.tsx:27`). Un rechargement ou un retour arrière ramène toujours sur « Carte de la classe ».
- **G4. Un devoir hors programme reste invisible sur la carte.**
  - **Constat :** le devoir « Premier devoir de la semaine » porte sur _Fonctions affines_ (programme de 3e). La fiche d'Élève Deux montre « Fonctions affines, 60 % ». La carte de la 4e A (13 notions) et l'onglet Élèves (« 0 / 13 ») n'en montrent rien.
  - **Proposition :** une rangée « Hors programme » sur la carte, ou un avertissement au moment de donner le devoir (le dialogue mélange les exercices de la classe et les autres sans les distinguer).
- **G5. La liste d'exercices sur mobile est une table de 43 lignes et 9735 px de haut**, sans pagination ni recherche (`prof/exercices-mobile.png`). Les colonnes Notion, Type et Statut y sont illisibles.
- **G6. `/compte/conditions` réaffiche le formulaire « Accepter et continuer »** alors que les conditions sont déjà acceptées (`prof/conditions-desktop.png`). La page `apps/web/src/app/compte/conditions/page.tsx` ne vérifie pas l'état. Elle devrait renvoyer vers `/compte`, ou afficher « Déjà acceptées le … ».
- **G7. Fuseau incohérent entre deux pages.**
  - **Constat :** les notifications affichent « Fuseau horaire : Non choisi (UTC) » (`prof/notifs-desktop.png`), alors que l'agenda dit « Heures affichées dans votre fuseau : Africa/Porto-Novo ».
  - **Risque :** les heures calmes et les rappels risquent de partir en UTC.
  - **Proposition :** préremplir avec le fuseau du navigateur, et le signaler.

### Cosmétique

- **C1. Le titre de la fiche exercice est l'objectif complet.** Sur `/prof/exercices/[id]`, le fil d'Ariane et le H1 reprennent une phrase de 150 caractères, sur deux lignes en 36 px (`prof/i-exo-detail.png`). Il faut tronquer le fil d'Ariane et donner un titre court.
- **C2. Carte « Vérification » d'un exercice déjà validé.** Elle dit encore « Prévisualisez des variantes, puis faites vérifier l'exercice… » alors que la pastille affiche « Validé ».
- **C3. Constellation peu lisible.**
  - Les liens se croisent en faisceau entre les colonnes 1 et 2.
  - La barre d'état des nœuds « Non vue » est presque invisible : beige sur beige.
  - Toutes les notions affichent « 0 élèves sur 3 ont validé cette notion ». Il faut écrire « 0 élève » au singulier pour 0 et 1, avec un ICU `plural`.
- **C4. Sélecteur « Notion » de la fiche exercice.** Plusieurs notions homonymes apparaissent (« Théorème de Pythagore », « Calcul littéral », etc. en double). Elles viennent de programmes différents, mais `NativeSelect` les présente comme une simple liste.
- **C5. Colonne « Variantes » de l'onglet Devoirs.** « Toutes prêtes » est en gris clair, comme un texte désactivé, alors que c'est un état positif.
- **C6. Libellés d'accessibilité de la grille de la semaine.** Chaque cellule horaire est un `<button>` dont l'`aria-label` porte une date au format du navigateur (`views.tsx:226-229`). Cela fait 84 boutons dans l'ordre de tabulation, ce qui est lourd au clavier.

## 3. Problèmes d'UX et propositions

1. **L'accueil ne dit pas qui a besoin du prof.**
   - **Constat :** le sous-titre promet « les élèves qui ont besoin de vous », mais la carte de classe se limite à « Personne ne bloque ».
   - **Proposition :** une section « À regarder aujourd'hui », avec les élèves bloqués, les devoirs bientôt dus et faiblement rendus, et les séances du jour (avatars et lien direct vers la fiche).
2. **Banque : le prof ne voit pas l'exercice qu'il va retenir.**
   - **Constat :** le gabarit brut (B2) l'oblige à ouvrir l'aperçu pour chaque carte.
   - **Proposition :** montrer une variante rendue dans la carte, avec un aperçu repliable. Ajouter un tri en masse (« Retenir tout ce chapitre ») et un raccourci clavier R/E.
3. **Banque : la séquence en 3 étapes reste affichée en permanence.** Elle occupe 110 px en haut de la page à chaque visite. Mieux vaut la replier après la première fois, ou la remplacer par une frise d'avancement (« 8 à trier, 0 retenu, 0 donné »).
4. **Bibliothèque d'exercices sans outils.**
   - **Constat :** aucune recherche, aucun filtre par notion ou par type, aucun tri, aucune pagination, pour 43 éléments déjà.
   - **Proposition :** un champ de recherche, des filtres sous forme de pastilles (notion, type, source), un tri par date ou par notion, et des cartes au lieu d'une table sur mobile.
5. **Devoirs : on ne peut pas descendre au niveau de l'élève.**
   - **Constat :** les lignes ne sont pas cliquables, donc on ne sait pas qui n'a pas rendu ni qui a échoué.
   - **Proposition :** un panneau latéral (Sheet) par devoir, avec la liste des élèves, l'état de chacun, la variante reçue et un lien vers sa fiche. Ajouter « Relancer les retardataires », qui ouvre un message pré-rempli.
6. **Fiche élève.**
   - Le statut « En cours » est répété sans dire depuis quand.
   - Les « Preuves » sont de simples pastilles « Réussi » sans date ni lien.
   - **Proposition :**
     - un petit graphique d'évolution de la maîtrise par notion (courbe dans le temps) ;
     - une chronologie des preuves (date, exercice, réponse) ;
     - un bouton « Écrire à l'élève ou au parent » ;
     - un bouton « Planifier une séance avec cet élève ».
7. **Observations.**
   - **Constat :** le formulaire impose deux listes déroulantes, sans aperçu de ce que l'observation va changer et sans historique des observations déjà faites.
   - **Proposition :** des puces de sélection rapide, un historique horodaté et la possibilité d'annuler.
8. **Agenda.**
   - **Constat :** sur mobile, la semaine n'affiche que 3 jours (lundi à mercredi) sans moyen de défiler, et la navigation reste sur des semaines entières (`prof/agenda-mobile.png`).
   - **Proposition :** sur mobile, une vue jour ou 3 jours avec balayage, et une liste « À venir » au-dessus de la grille.
   - **Bureau :**
     - on ne peut pas créer un créneau en faisant glisser la souris ;
     - on ne peut pas déplacer ni redimensionner une séance par glisser-déposer ;
     - les disponibilités sont listées sous le calendrier au lieu d'être peintes dessus quand il n'y en a pas.
   - **Prévoir :** le glisser-déposer, avec une confirmation qui prévient les participants.
9. **Séance en visio.** Le lien Jitsi s'ouvre dans un nouvel onglet (`session-parts.tsx:93-120`). Il manque une salle d'attente dans la page : test du micro et de la caméra, compte à rebours, bouton « Rejoindre » actif 10 minutes avant. Cette partie n'a pas pu être vérifiée faute de séance dans la démo.
10. **Messagerie vide.**
    - **Constat :** « Aucune conversation pour l'instant » apparaît à gauche et « Choisissez une conversation pour la lire » à droite. Deux états vides cohabitent, sans action proposée.
    - **Proposition :** un seul état vide centré, avec une illustration et les boutons « Écrire à la classe 4e A » et « Écrire à un parent ».
    - Dans « Nouveau message », remplacer la liste déroulante native par une recherche (Command) avec des avatars et des groupes (Classe, Élèves, Parents).
11. **Le menu utilisateur (bas de la barre latérale) ne montre pas d'emblée « Notifications » et « Se déconnecter » sur mobile.** C'est un point mineur. Il faudrait les rendre accessibles dans l'en-tête mobile.

## 4. Refonte visuelle, page par page

L'état actuel est un shadcn standard : fond crème, cartes blanches `rounded-xl`, boutons noirs, icônes Phosphor fines et grises. Rien ne rappelle le site :
- aucun cadre `tk-frame` ;
- aucune étiquette Geist Mono en majuscules ;
- aucune pastille d'icône en couleur `GlowTile` ;
- le jaune `#FFC529` n'apparaît que sur le logo et l'onglet actif.

Le point de comparaison reste `apps/web/src/app/connexion/auth-card.tsx` et `auth.css`.

**Principes communs (barre latérale, en-têtes, cartes) :**
- **Barre latérale :**
  - icônes dans de petites pastilles `GlowTile` de 28 px, une couleur par rubrique (banque en jaune, exercices en violet, agenda en bleu, messages en vert) ;
  - élément actif avec un fond jaune pâle et une barre jaune de 3 px ;
  - nom de l'espace « PROF » en étiquette Geist Mono majuscule.
- **En-têtes de page (`PageHeader`) :**
  - au-dessus du titre, une étiquette mono (« CLASSE · 4E A », « BANQUE · SEMAINE 46 ») ;
  - titre Geist en graisse légère (300) ;
  - apparition du titre mot par mot (fade et translate de 6 px, 40 ms de décalage, désactivée si `prefers-reduced-motion`).
- **Cartes :** fond papier grainé, bordure 1 px plus chaude, arrondi de 16 px. Le cadre biseauté `tk-frame` est réservé aux éléments forts : la carte de classe, la carte de la banque et le dialogue d'aperçu.

**Page par page :**
- **Accueil `/prof` :**
  - la carte de classe devient une « tuile classe » avec un `GlowTile` (icône chapeau), trois statistiques en chiffres Geist et un anneau de progression ;
  - le bloc banque montre un compteur « 8 À TRIER » en mono jaune, et des lignes avec une pastille de notion colorée.
- **Banque :**
  - les cartes d'exercice portent une étiquette mono du type de tâche (« RÉSOUDRE », « CALCULER ») au lieu d'une pastille contour ;
  - l'énoncé rendu est en police math ;
  - au survol, les boutons Retenir et Écarter deviennent des boutons pleins (vert doux et gris), et « Retenir » s'accompagne d'une micro-animation (coche qui se dessine, carte qui glisse vers « Retenus ») ;
  - les onglets d'état prennent la forme d'un contrôle segmenté avec des compteurs en mono ;
  - la frise des 3 étapes s'illustre avec les icônes animées de `wa/ui/icons` (étincelle, tri, envoi).
- **Exercices :**
  - la table devient une liste de cartes compactes sur mobile, et une table sur bureau avec un en-tête mono majuscule ;
  - les statuts sont des pastilles colorées : Validé en vert avec un sceau, Brouillon en gris, Archivé barré.
- **Fiche exercice :**
  - titre court, avec l'objectif en paragraphe ;
  - sections numérotées (« 01 · CE QUE L'EXERCICE ÉVALUE », « 02 · CALCUL ET ÉNONCÉ ») ;
  - l'éditeur d'énoncé surligne les `{a}` en pastilles.
- **Classe :**
  - la constellation sur un fond grainé : nœuds arrondis à 14 px, anneau de progression coloré par état au lieu de la barre, liens courbes animés au survol (le chemin des prérequis s'allume en jaune) ;
  - la grille élèves × notions devient une carte de chaleur (voir la section 5) ;
  - les onglets prennent la forme d'un contrôle segmenté avec des icônes.
- **Devoirs :**
  - barre de rendu en jaune au lieu du noir ;
  - échéance en mono (« 14 NOV · 18:00 ») ;
  - pastille « Clos » ou « Bientôt dû » colorée.
- **Fiche élève :**
  - en-tête avec avatar à initiales et `GlowTile` ;
  - barres de maîtrise en dégradé jaune à vert ;
  - preuves en chronologie verticale ;
  - carte « Besoins déclarés » avec une icône bouclier en `GlowTile` violet.
- **Agenda :**
  - en-tête de jours en mono majuscule, déjà proche du site, à conserver ;
  - aujourd'hui marqué d'une pastille jaune plutôt que noire ;
  - séances en blocs arrondis de 10 px avec une bande de couleur par type (visio, groupe) ;
  - disponibilités hachurées ;
  - ligne « maintenant » rouge et animée ;
  - transition en glissement de 8 px au changement de semaine.
- **Messages :**
  - bulles arrondies à 18 px, avec une queue côté auteur : jaune pâle pour soi, blanc pour l'autre ;
  - avatars ;
  - séparateurs de jour en mono ;
  - indicateur « vu ».
- **Compte et notifications :**
  - reprendre le gabarit `AuthCard` (cadre `tk-frame`) pour `/compte` ;
  - pour chaque canal (in-app, e-mail, WhatsApp, SMS), un `GlowTile` avec le logo du canal, au lieu d'une liste de boutons radio ;
  - heures calmes en plage horaire visuelle (curseur à deux poignées) au lieu de deux listes de 24 options.
- **Dialogues :**
  - arrondi de 20 px ;
  - titre léger avec une étiquette mono au-dessus ;
  - ouverture en scale de 0,98 à 1 avec un fondu de 150 ms ;
  - bouton principal jaune `#FFC529` avec un texte noir, comme sur le site.

## 5. Composants nécessaires pour l'espace prof

| Besoin                                    | Existe dans `packages/ui`                                                                        | À créer ou compléter                                                                                                                                                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calendrier semaine, mois et année         | Non. Le calendrier est maison, dans `apps/web/src/components/agenda/views.tsx` et `calendar.tsx` | Le déplacer dans `packages/ui` comme `Calendar` / `WeekGrid`, avec :<br>• une vue jour ou 3 jours sur mobile ;<br>• le glisser pour créer un créneau ;<br>• le glisser-déposer et le redimensionnement des séances, avec confirmation ;<br>• une ligne « maintenant » ;<br>• le format via next-intl (G1) |
| Sélecteur de date et d'heure              | Non. Les champs sont des `<input type="date/time/datetime-local">` natifs                        | `DatePicker` / `TimePicker` en français, construits sur `Popover`                                                                                                                                                                                                                                         |
| Tableau de données                        | `table.tsx`, sans aucune logique                                                                 | `DataTable` (TanStack Table) :<br>• tri par colonne ;<br>• filtres en pastilles ;<br>• recherche ;<br>• pagination ;<br>• bascule en cartes sous 640 px ;<br>• conteneur `min-w-0` (B1)                                                                                                                   |
| Carte de chaleur élèves × notions         | Non. Aujourd'hui c'est une table de `StatusBadge`                                                | `MasteryHeatmap` :<br>• cellules carrées colorées par état ;<br>• en-têtes de notion inclinés ou tronqués avec infobulle ;<br>• première colonne collante ;<br>• défilement interne                                                                                                                       |
| Constellation des notions                 | Maison (`teacher/class-map.tsx`)                                                                 | `NotionGraph` :<br>• placement qui limite les croisements ;<br>• zoom et défilement ;<br>• surbrillance du chemin des prérequis ;<br>• anneaux d'état                                                                                                                                                     |
| Graphique de progression                  | `chart.tsx` et `recharts.tsx` existent                                                           | `ProgressLine` (maîtrise dans le temps) et `MasteryBar` en dégradé, aux couleurs du site                                                                                                                                                                                                                  |
| Carte d'exercice et rendu math            | Non                                                                                              | `ExerciseCard`, avec un énoncé rendu et des pastilles pour les `{param}`                                                                                                                                                                                                                                  |
| Bulles de discussion                      | Non. Le fil est maison, dans `components/messages/thread-view.tsx`                               | `ChatBubble`, `DaySeparator`, `Composer` avec pièce jointe                                                                                                                                                                                                                                                |
| Sélecteur de destinataire                 | `command.tsx` existe                                                                             | `RecipientPicker` (Command, avatars et groupes)                                                                                                                                                                                                                                                           |
| Téléversement                             | Non                                                                                              | `FileDrop` pour les pièces jointes et l'import d'exercices                                                                                                                                                                                                                                                |
| Pastille d'icône en couleur               | Non. Elle n'existe que dans `apps/site/src/wa`                                                   | Porter `GlowTile` et les icônes animées dans `packages/ui`                                                                                                                                                                                                                                                |
| Cadre biseauté                            | Non. Il n'existe que dans le site et dans `auth.css`                                             | Composant `Frame` (`tk-frame`) avec une variante à arrondi doux                                                                                                                                                                                                                                           |
| Contrôle segmenté et onglets liés à l'URL | `tabs.tsx` et `toggle-group.tsx` existent                                                        | Variante `Segmented` et synchronisation `?tab=` (G3)                                                                                                                                                                                                                                                      |
| Panneau de détail                         | `sheet.tsx` existe                                                                               | À utiliser pour le détail d'un devoir                                                                                                                                                                                                                                                                     |
| États vides                               | Non                                                                                              | `EmptyState` : illustration, texte et actions                                                                                                                                                                                                                                                             |
