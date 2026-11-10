# Revue de l'espace élève : novembre 2026

- **Périmètre** : l'espace élève de https://wema.winneragency.co/app, avec les pages communes qu'un élève voit (`/`, `/compte`, `/compte/notifications`, `/compte/conditions`, pages légales, 404).
- **Comptes** : `eleve1@wema.test` en compte principal ; `eleve2` et `eleve3` pour comparer.
- **Mode** : navigation en lecture seule, menée le 10 novembre 2026 avec Playwright, en 1440 × 900 et en 390 × 844 (mobile tactile).
- **Ce qui n'a pas été fait** : aucune séance IA lancée, aucune photo envoyée, aucune réponse validée, aucune préférence modifiée.
- **Seuls effets de bord possibles** : l'ouverture des formats « Lecture facile » et « BD » demande à l'API une reformulation. Elle est gardée en cache et ne touche aucune donnée de l'élève.

**Captures** : dossier `/private/tmp/claude-501/-Users-olivierkakpo-dev-Projet-de-prof-particulier-IA/6fb95da0-1112-4cce-aaac-04134c293912/scratchpad/audit/eleve/`, appelé `…/eleve/` plus bas. Les fichiers `e2-*` et `e3-*` viennent d'eleve2 et d'eleve3.

**Bilan technique global**, sur 3 comptes × 2 tailles d'écran, soit environ 200 états :
- aucune erreur de console ;
- aucune requête en 4xx ou 5xx (hors la 404 provoquée volontairement) ;
- aucun défilement horizontal de page ;
- aucune clé i18n brute, aucun `undefined`, `null`, `NaN` ni `Invalid Date` ;
- aucun chargement infini.

Les problèmes trouvés relèvent de la **logique**, de la **cohérence des données affichées** et du **style**.

---

## 1. Pages visitées

| Route | Ce qu'on y fait | Captures (`…/eleve/`) |
|---|---|---|
| `/` | Aiguillage : redirige l'élève vers `/eleve` | `00-racine-{desktop,mobile}.png` |
| `/eleve` | Accueil : prochaine étape, devoirs à venir, progression, « Ensuite » | `01-accueil-*.png`, `e2-01-*`, `e3-01-*`, `20-accueil-sombre-desktop.png` |
| menus (mobile et desktop) | Tiroir de navigation ; menu utilisateur (compte, notifications, thème, déconnexion) | `17-menu-mobile.png`, `17-menu-utilisateur-desktop.png`, `01c-menu-utilisateur-desktop.png` (clic sur l'en-tête « Wema Élève » : rien ne s'ouvre) |
| `/eleve/devoirs` | Devoirs groupés par statut | `02-devoirs-*.png`, `e3-02-devoirs-desktop.png` |
| `/eleve/exercices` | Liste des variantes d'exercices | `03-exercices-*.png`, `e3-03-exercices-desktop.png` |
| `/eleve/exercices/[id]` | Énoncé, choix du format, pas à pas, réponse MathLive, aide, photo | `04-exercice{1,2,3}-*.png`, `e3-04-exercice2-desktop.png` (exercice « À faire ») |
| formats | Texte, Lecture facile, Bande dessinée, Audio | `04-exercice*-format-{0..3}-*.png`, `18-bd-attente-desktop.png` |
| photo de copie | Panneau « Ta feuille en photo » ouvert, sans envoi | `04-exercice*-photo-*.png` |
| clavier MathLive | Clavier virtuel ouvert (desktop et mobile) | `19-mathlive-clavier-desktop.png`, `19-mathlive-mobile.png`, `20-exercice-sombre-desktop.png` |
| `/eleve/prof-ia` | Nouvelle séance (5 modes) et historique | `05-prof-ia-*.png`, `05-prof-ia-mode{0..4}-desktop.png`, `05-prof-ia-lien-notion-*.png`, `21-prof-ia-fonctions-affines-desktop.png`, `e2-05-prof-ia-mobile.png` (liste vide) |
| `/eleve/prof-ia/[id]` | Conversation terminée : aide sur exercice ×2, entretien « Faisons connaissance » | `06-seance-ia{1,2,3}-*.png` |
| `/eleve/progression` | « Mon chemin » : 13 notions de 4e A Maths | `07-progression-*.png` |
| `/eleve/agenda` | Prochaines séances et calendrier semaine, mois, année | `08-agenda-*.png`, `08-agenda-vue-*.png` |
| réservation | Dialogue « Réserver une séance » (eleve2 seulement) | `e2-08-agenda-reserver-{desktop,mobile}.png` |
| `/eleve/agenda/seances/[id]` | **Non visitée** : aucun des trois comptes n'a de séance, ni passée ni à venir, donc aucun lien | — |
| `/eleve/messages` | Messagerie vide et dialogue « Écrire à un prof » | `10-messages-*.png`, `10-messages-mobile2.png` |
| `/eleve/profil` | Ce que Wema a compris, préférences, intérêts, notions | `11-profil-desktop.png`, `11-profil-mobile2.png` |
| `/compte` | Compte, export JSON, suppression (gérée par le parent) | `12-compte-*.png` |
| `/compte/notifications` | Canaux, heures calmes, fuseau, derniers envois | `13-notifications-*.png` |
| `/compte/conditions` | Conditions acceptées | `14-conditions-*.png` |
| `/confidentialite` (et autres pages légales) | Pied de page légal | `22-confidentialite-desktop.png` |
| erreurs | Exercice inexistant, séance IA inexistante, `/prof` (sans droit), 404 | `15-*.png`, `16-*.png` |

---

## 2. Erreurs et bugs

### Bloquant

**B1. « Entraîne-toi · Fonctions affines » mène à une impasse.**
- **Où** : `/eleve`, section « Ensuite » (eleve1, eleve2 et eleve3).
- **Reproduire** :
  1. Cliquer la carte.
  2. On arrive sur `/eleve/prof-ia?mode=course_question&notion=f6e28831…`.
  3. Le menu « Notion » reste sur « Choisis une notion » et le bouton « Commencer » est désactivé : vérifié, `select.value = ""` et `disabled = true` (`21-prof-ia-fonctions-affines-desktop.png`).
- **Cause** : la notion « Fonctions affines » (programme de 3e) sort de `/learner/next` et figure dans le profil (`/eleve/profil`, « Tes notions », 60 %). En revanche, elle **n'est pas dans le parcours de la classe** renvoyé par `/learner/path` (13 notions de 4e). Or la page prof IA construit la liste des notions à partir de ce parcours seulement.
- **Fichiers** : `apps/web/src/app/eleve/prof-ia/page.tsx` (`notions` vient de `classes`), `apps/web/src/components/learner/tutor-new-session.tsx`. Côté API, la génération des actions (`/learner/next`) propose une notion hors parcours. Le devoir « Premier devoir de la semaine » (fonction affine) est rattaché à cette notion.

**B2. Le champ réponse MathLive reste modifiable sur un exercice terminé.**
- **Où** : tout exercice réussi ou épuisé (`/eleve/exercices/37844af4…`).
- **Reproduire** : cliquer dans le champ. Le clavier mathématique s'ouvre et on peut taper (`19-mathlive-*.png`), alors qu'il n'y a plus de bouton « Vérifier » ; mesuré : `math-field.readOnly === false`.
- **Cause** : `apps/web/src/components/learner/math.tsx`.
  - L'effet `useEffect(() => { if (field.current) field.current.readOnly = disabled === true }, [disabled])` s'exécute avant que MathLive soit chargé, de façon asynchrone. `field.current` est alors `null`.
  - Comme `disabled` ne change plus ensuite, `readOnly` n'est jamais appliqué.
  - **Correction** : appliquer `readOnly` à la création du `MathfieldElement`, ou ajouter `state` aux dépendances.

### Gênant

**G1. Les chiffres de progression ne concordent pas d'une page à l'autre.**
- **Accueil** : « 0 validée · 1 en cours · 0 à travailler, sur 13 notions ».
- **Accueil, section « Ensuite »** : deux notions annoncées « en cours » (Équations et Fonctions affines).
- **Profil** : 2 notions « En cours ».
- **Mon chemin** : une seule notion en cours, et pas de Fonctions affines.
- **Exercices** : les deux exercices d'équations sont « Réussi », mais le profil indique « 2 réponses récentes, 1 juste » et Mon chemin « 2 réponses ».
- **Fichiers** : `app/eleve/page.tsx` (compte sur `classes`), `app/eleve/progression/page.tsx`, `app/eleve/profil/page.tsx`. Même origine que B1 : notions hors parcours.

**G2. « Prochaine notion du programme, prérequis validés » s'affiche alors qu'aucune notion n'est validée.**
- **Où** : accueil, carte « Carrés et racines carrées ».
- **Problème** : c'est vrai si la notion n'a pas de prérequis, mais l'élève lit une contradiction avec « 0 validée ».
- **Source** : texte `reason` produit par l'API (`/learner/next`).

**G3. Les boutons « Entraîne-toi » ouvrent une conversation, pas un exercice.**
- **Où** : accueil, carte « Ta prochaine étape » (eleve1 et eleve2).
- **Problème** : le titre « Entraîne-toi · Équations » mène à « Ouvrir avec le prof IA » → `/eleve/prof-ia?mode=course_question` (question de cours). L'élève attend un exercice.
- **Source** : `apps/web/src/components/learner/actions.ts` (`actionTarget`).

**G4. Les pages légales affichent des marques « [À compléter : …] » à tous les élèves.**
- **Où** : pages légales, liées depuis le pied de chaque page de l'espace.
- **Comptage** : 10 sur `/confidentialite`, 13 sur `/mentions-legales`, 4 sur `/conditions` (par exemple « [À compléter : raison sociale de l'éditeur] »).
- **Source** : `apps/web/messages/fr/legal.json`.

**G5. Le premier chargement de la BD affiche seulement « Je prépare l'énoncé… » pendant plus de 4 secondes.**
- **Où** : `04-exercice1-format-2-bande-dessin-e-desktop.png`, exercice 1.
- **Constat** : un texte gris, sans animation ni squelette. Une fois en cache, la BD répond en moins de 100 ms.
- **Source** : `components/formats/exercise-formats.tsx`.

**G6. L'agenda montre comme « À rendre » des devoirs déjà réussis.**
- **Où** : calendrier, les 3 devoirs d'eleve1.
- **Constat** : l'étiquette « 16:36 À rendre : P… » ne dit pas que le devoir est fait.
- **Source** : `components/agenda/calendar.tsx` et `views.tsx`.

**G7. Aucun moyen de réserver, sans explication.**
- **Où** : agenda d'eleve1.
- **Constat** : pas de bouton « Réserver une séance », et aucun texte qui dise pourquoi ni à qui s'adresser. Chez eleve2, le bouton existe.
- **Dans le dialogue de réservation** : « Aucun créneau libre cette semaine » sans proposer la prochaine semaine qui en a, et sans nommer le prof.
- **Source** : `components/agenda/family-agenda.tsx`.

**G8. Le clavier MathLive cache le champ réponse sur desktop.**
- **Où** : `19-mathlive-clavier-desktop.png`.
- **Constat** : le clavier ouvert recouvre « Ta réponse ». La page ne défile pas pour garder le champ visible, et il manque une marge basse équivalente à la hauteur du clavier.
- **Contenu du clavier** : celui de MathLive par défaut (intégrale, ∀, e, i, ln, sin), hors programme de collège.
- **Source** : `components/learner/math.tsx`, à reconfigurer avec `mathVirtualKeyboard.layouts`.

### Cosmétique

**C1. L'en-tête « Wema / Élève » de la barre latérale réagit au survol et au clic mais n'ouvre rien quand l'utilisateur n'a qu'un espace.**
- **Source** : `components/shell/app-shell.tsx`, `DropdownMenuTrigger` toujours rendu.
- **Correction** : ne rendre qu'un simple bloc quand `spaces.length === 1`.

**C2. Le tutoiement et le vouvoiement se mélangent.**
- **Vouvoiement** :
  - `/compte` : « Vos informations, vos données et vos droits », « vous pouvez l'annuler » ;
  - agenda : « Heures affichées dans **votre** fuseau » (`messages/fr/agenda.json`, `calendar.timeZone`).
- **Tutoiement** : partout ailleurs dans l'espace élève, y compris `/compte/notifications`.

**C3. Le fuseau s'affiche en identifiant technique « Africa/Porto-Novo ».**
- **Où** : agenda et menu « Fuseau horaire » des notifications.
- **Proposition** : « heure du Bénin (UTC+1) ».

**C4. Des valeurs techniques apparaissent sur `/compte`.**
- **Constat** : « Conditions version 2026-11-03, confidentialité version 2026-11-03 ».

**C5. Les formules ne sont pas toujours rendues en mathématiques.**
- **Constat** : « f(x) = 6x + 7 » reste en texte brut dans la liste d'exercices, la page d'exercice et l'énoncé de la séance IA, alors que les équations des autres exercices sont rendues par MathLive.
- **Cause** : le champ `rendered` de cette variante ne contient pas la formule (données ou `services/math`).
- **Conséquence** : les messages du prof IA restent eux aussi en texte brut (`tutor-chat.tsx`, `Bubble`), y compris pour « 6 × 2 + 7 ».

**C6. La typographie des bulles de BD casse en fin de ligne.**
- **Constat** : « clin d'œil » puis « ! » seul sur la ligne suivante, ainsi que « À toi de jouer » puis « ! » (`04-exercice2-format-2-bande-dessin-e-desktop.png`).
- **Correction** : remplacer l'espace avant `! ? : ;` par une espace fine insécable.

**C7. Les cases de BD ne correspondent pas à leur légende.**
- **Constat** : chaque case dessine un personnage standard devant un rectangle. La légende dit « un ballon posé sur l'herbe près des cages », « posters de mangas », mais aucun de ces objets n'est dessiné.
- **Source** : `components/formats/comics.tsx`.

**C8. La page Messages vide est plus haute que l'écran à 1440 × 900 (960 px), sans contenu à faire défiler.**

**C9. Les pages « introuvable » sont pauvres.**
- **Où** : exercice ou séance IA inexistants (`15-*.png`).
- **Constat** : une ligne grise, sans titre `h1`, sans illustration ni lien vers la liste. Pour la séance, le texte est générique : « Introuvable : cet élément n'existe plus. »

**C10. `/prof` sans droit redirige vers `/eleve` en silence.**
- **Constat** : la redirection est correcte, mais aucun message ne l'explique.

---

## 3. Problèmes d'UX et propositions

1. **L'accueil n'a pas de hiérarchie motivante.**
   - **Constat** :
     - la barre de progression est grise et vide à 0 validée (`01-accueil-*`) ;
     - « Devoirs à venir » affiche « Aucun devoir » sans rien célébrer, alors que les 3 devoirs sont réussis.
   - **Proposition** :
     - remplacer la barre par un anneau ou un chemin miniature qui compte aussi les notions **en cours** (couleur partielle) ;
     - afficher un état « Tout est rendu ✓ » festif quand tous les devoirs sont faits ;
     - ajouter une série de jours d'activité.
2. **Le formulaire « Nouvelle séance » est long sur mobile.**
   - **Constat** : venant de l'accueil avec mode et notion déjà choisis, l'élève doit descendre sous 5 grandes cartes radio pour trouver « Commencer » (`05-prof-ia-lien-notion-mobile.png`).
   - **Proposition** : quand mode et notion arrivent dans l'URL, afficher un récapitulatif (« Question de cours · Équations du premier degré ») avec « Commencer » en haut, et replier les autres modes sous « Changer ».
3. **L'historique des séances IA manque de contexte.**
   - **Constat** : deux lignes « Aide-moi sur un exercice », l'une sans aucun nom d'exercice (`05-prof-ia-desktop.png`).
   - **Proposition** : afficher le titre du devoir ou le début de l'énoncé, le nombre d'échanges, une icône par mode, et regrouper par jour.
4. **La conversation IA ressemble à un formulaire.**
   - **Constat** :
     - pas d'avatar du prof IA, pas d'heure ;
     - trois messages du tuteur se suivent sans séparation (`06-seance-ia1-desktop.png`) ;
     - le bouton « Écouter » est très discret.
   - **Proposition** :
     - avatar du prof IA (pastille jaune animée pendant la réflexion) ;
     - regroupement des messages consécutifs ;
     - horodatage au survol ;
     - rendu des formules et du gras ;
     - « Écouter » en vraie icône-bouton ;
     - récapitulatif de fin de séance (notion travaillée, prochaine étape).
5. **Les fonctions vocales ne se voient pas dans les données de démo.**
   - **Constat** : la dictée et le composeur n'apparaissent que dans une séance **ouverte**, or toutes les séances de démo sont terminées. Le mode oral (« Je justifie ma démarche ») n'est pas démontrable.
   - **Proposition** : garder une séance ouverte dans les données de démo.
6. **Exercice terminé : on ne sait pas ce qu'on avait répondu.**
   - **Constat** :
     - le message « Tu as déjà réussi cet exercice » est un bloc gris neutre ;
     - le champ reste vide (et modifiable, voir B2) ;
     - « Explique ta démarche » et « Envoyer une photo » sont deux boutons gris de même poids.
   - **Proposition** :
     - afficher la réponse donnée, figée ;
     - carte de réussite verte ou jaune avec pictogramme ;
     - un seul appel à l'action principal (« Exercice suivant ») et les actions secondaires en liens.
7. **« Pas à pas » est entièrement déplié d'emblée.**
   - **Constat** : sur les exercices guidés, « Tu as vu toutes les étapes » s'affiche alors que l'élève n'a rien demandé.
   - **Proposition** : révéler les étapes une à une, avec une animation de dépliage.
8. **La liste des exercices propose « Faire l'exercice » sur des exercices déjà réussis, et ne propose aucun tri.**
   - **Proposition** : « Revoir » pour les exercices réussis ; filtres À faire / Réussis ; exercices à faire en premier.
9. **Les mêmes exercices apparaissent sous Devoirs et sous Exercices.**
   - **Constat** : les deux entrées de menu se recoupent entièrement (les 3 exercices sont des devoirs).
   - **Proposition** : fusionner en « Mes exercices » avec un onglet Devoirs, ou réserver Exercices à l'entraînement libre.
10. **Le profil affiche un badge « Plutôt vrai » avec une confiance de 35 %, sur six cartes identiques.**
    - **Proposition** : formuler « Wema pense que… » avec une jauge, et regrouper les centres d'intérêt en pastilles plutôt qu'en cartes.
11. **Les préférences n'ont pas de bouton d'enregistrement.**
    - **Constat** : les interrupteurs, les intérêts et la lecture facile se modifient sans bouton (je ne les ai pas actionnés).
    - **Proposition** : afficher un toast « Enregistré ».
12. **Agenda sur mobile.**
    - **Constat** : la vue semaine montre 3 jours sur 7 dans un défilement horizontal interne, et la colonne des heures défile avec (`08-agenda-vue-semaine-mobile.png`).
    - **Proposition** : sur mobile, vue « liste du jour » ou défilement des jours avec la colonne des heures fixe. Les étiquettes de devoirs sont tronquées (« À rendre : P… ») : préférer une icône et un titre court.
13. **La messagerie vide n'oriente pas l'élève.**
    - **Proposition** : un état vide illustré avec le bouton « Écrire à mon prof » centré. Ajouter un libellé au champ du message dans le dialogue, qui n'a qu'un texte indicatif.
14. **Le compte et les notifications sortent de la mise en page.**
    - **Constat** : `/compte` et `/compte/notifications` quittent la barre latérale. Leurs mises en page diffèrent entre elles (logo et pied sur l'une, pas sur l'autre ; largeurs 768 et 640 px), et `/compte` n'a pas de lien vers les notifications.
    - **Proposition** : intégrer les deux pages au shell de l'espace, sous un onglet « Réglages ».
15. **Les canaux grisés ne s'expliquent pas.**
    - **Constat** : « Par e-mail » est grisé alors que le compte a une adresse e-mail. L'explication est placée sous les blocs, loin des boutons.
    - **Proposition** : une ligne d'aide sur l'option elle-même (« Vérifie ton adresse pour l'activer → »).

---

## 4. Refonte visuelle page par page

**Principes communs, repris du site** (`apps/site/src/wa/`) et des pages de connexion (`app/connexion/auth.css`) :
- fond papier grainé ;
- titres Geist en graisse légère, à la place d'Urbanist en gras ;
- étiquettes de section en Geist Mono majuscules ;
- pastilles d'icônes lumineuses colorées (`GlowTile`) ;
- jaune `#FFC529` réservé à l'action principale ;
- cadres biseautés `tk-frame` pour **les seuls** éléments héros (prochaine étape, carte de réussite) ;
- partout ailleurs, arrondis doux (12 à 16 px) ;
- icônes animées `wa/ui/icons` dans la navigation.

Aujourd'hui, l'espace élève reprend shadcn presque tel quel :
- cartes blanches à bord beige fin ;
- badges noirs « Réussi » ;
- boutons gris ;
- icônes Phosphor fines monochromes ;
- aucune animation, hormis les trois points de réflexion et la pulsation du micro.

C'est ce qui donne l'impression de « gabarit ».

**Shell (barre latérale et en-tête)**
- Pastille « W » à remplacer par le logo du site.
- Chaque entrée de menu reçoit une icône colorée dans une petite `GlowTile` : Devoirs en jaune, Exercices en vert, Prof IA en violet, Chemin en orange, Agenda en bleu, Messages en rose.
- L'élément actif est marqué par une barre jaune et une icône animée au survol (`use-icon-motion`).
- Ajouter en bas une carte « série de X jours ».
- Sur mobile, une **barre d'onglets en bas** (Accueil, Exercices, Prof IA, Chemin, Plus) au lieu du tiroir caché derrière une icône de panneau.

**Accueil**
- **En-tête** : étiquette mono « MON ESPACE », titre léger « Salut Kofi » (le prénom est connu par l'entretien), sous-titre.
- **« Ta prochaine étape »** : carte héros biseautée sur dégradé jaune, avec une illustration ou `GlowTile` de la notion et un bouton jaune biseauté comme sur la connexion. Entrée en fondu et légère montée.
- **Devoirs** : liste avec puces d'échéance colorées (en retard en rouge, bientôt en jaune).
- **Progression** : anneau animé du 0 vers la valeur au chargement.
- **« Ensuite »** : cartes avec icône par type d'action (s'entraîner, découvrir, faire connaissance) et flèche qui glisse au survol.

**Devoirs et exercices**
- **Carte d'exercice** :
  - pastille de matière colorée ;
  - titre ;
  - énoncé tronqué rendu en mathématiques ;
  - puce d'échéance ;
  - statut en pastille colorée et non en badge noir (À faire en jaune, Réussi en vert avec coche animée, En retard en rouge) ;
  - niveau en étoiles ou en barres plutôt que « Niveau 1 ».
- **Vides** : illustration et message.
- **Groupes** : titres en mono majuscules (« À FAIRE · 1 »).

**Page d'exercice**
- **Sélecteur de format** : 4 tuiles-icônes colorées (Texte, Lecture facile, BD, Audio) au lieu d'un groupe de boutons gris. Le format conseillé porte une étiquette jaune « CONSEILLÉ ».
- **Énoncé** : carte papier légèrement biseautée.
- **Pas à pas** : étapes en cartes numérotées, révélées avec une animation de dépliage.
- **Champ réponse** :
  - grand champ arrondi ;
  - bordure jaune au focus ;
  - bouton « Vérifier » jaune collé à droite ;
  - clavier MathLive restylé avec les variables CSS `--keyboard-*` (fond papier, touches arrondies, accent jaune au lieu du bleu MathLive) et réduit au collège : chiffres, x, fraction, puissance, racine, parenthèses, =.
- **Retour de correction** : voir les animations de réussite au § 5.
- **Photo de copie** : zone de dépôt illustrée (icône appareil photo dans une `GlowTile`), aperçu avec cadre de recadrage, et pendant la lecture une animation de balayage sur l'image.

**Formats**
- **Lecture facile** : déjà en Lexend et bien espacé. Ajouter un fond crème et un repère de ligne au survol.
- **BD** :
  - personnages plus expressifs (au moins 3 poses et expressions) et décors dessinés selon la légende (terrain, classe, chambre) ;
  - bulles avec pointe vers le locuteur ;
  - cases à angles biseautés, dans le langage du site ;
  - apparition case par case au défilement ;
  - squelette de cases en pointillés animés pendant la génération.
- **Audio** : gros bouton lecture rond jaune avec ondes animées pendant la lecture, et réglage de la vitesse (0,75 / 1 / 1,25).

**Prof IA (accueil)**
- **Modes** : 5 grandes tuiles-icônes en grille, chacune avec sa couleur et son icône (point d'interrogation, ampoule, tableau, micro, poignée de main), au lieu de boutons radio.
- **Historique** : chronologie groupée par jour, icône du mode, titre de l'exercice.

**Conversation prof IA**
- **Bulles** :
  - prof IA avec avatar rond jaune animé (respiration), bulle papier à coin inférieur gauche resserré ;
  - élève en bulle jaune pâle à droite ;
  - formules rendues en mathématiques ;
  - apparition en glissement de bas en haut.
- **Barre de saisie** : collée en bas, arrondie, avec micro (dictée) et envoi en icônes rondes, et compteur d'indices sous forme d'ampoules qui s'éteignent.
- **Fin de séance** : carte récapitulative avec ce qui a été travaillé et un bouton vers la suite.

**Mon chemin**
- La liste est déjà verticale et numérotée, ce qui est une bonne base. Il faut en faire un **chemin de jeu** :
  - ligne courbe ;
  - nœuds ronds colorés par statut, avec un cadenas sur les notions non vues verrouillées et une étoile sur les validées ;
  - marqueur « Tu es ici » animé (pulsation douce) ;
  - pourcentage de maîtrise en anneau autour du nœud.
- En tête, une étiquette mono « 4E A · MATHS » et un compteur « 1 / 13 ».
- Les liens soulignés « Travailler cette notion » deviennent de petits boutons.

**Agenda**
- **Calendrier** :
  - en-têtes de jours en mono ;
  - jour courant en pastille jaune ;
  - devoirs en puces colorées par statut ;
  - séances en blocs pleins à la couleur du prof.
- **Carte « Prochaines séances »** : visuel vide illustré.
- **Dialogue de réservation** : créneaux en grille de pastilles sélectionnables, avec le nom et l'avatar du prof.

**Messages**
- Liste à avatars ronds, aperçu du dernier message et pastille de non-lu jaune.
- Fil en bulles (même composant que le prof IA).
- État vide illustré.

**Profil**
- Carte d'identité en haut : avatar, prénom, classe, centres d'intérêt en pastilles colorées.
- « Ce que Wema a compris » sous forme de cartes compactes avec icône et jauge circulaire.
- Préférences : interrupteurs groupés avec icônes.

**Compte, notifications, pages d'erreur**
- Les intégrer au shell.
- Choix de canal en tuiles-icônes (application, e-mail, WhatsApp, SMS).
- Pages introuvables : titre, illustration, bouton de retour, dans le même gabarit que `not-found.tsx`.

**Thème sombre** : il fonctionne (`20-*-sombre-desktop.png`). Il faut vérifier le contraste des formules MathLive rendues, gris moyen sur fond sombre, et thémer le clavier virtuel.

---

## 5. Composants nécessaires pour cet espace

**Existe dans `packages/ui`** : alert, avatar, badge, breadcrumb, button, card, chart, recharts, checkbox, command, dialog, dropdown-menu, input, label, native-select, popover, progress, radio-group, scroll-area, select, separator, sheet, sidebar, skeleton, sonner, switch, table, tabs, textarea, toggle-group, toggle, tooltip.

**Existe dans `apps/web` mais spécifique** :
- `agenda/calendar.tsx` et `views.tsx` (calendrier semaine, mois, année) ;
- `learner/math.tsx` (MathLive) ;
- `learner/tutor-chat.tsx` (bulles internes, non exportées) ;
- `formats/comics.tsx`, `figure.tsx`, `balance-manipulable.tsx`, `pythagoras-manipulable.tsx` ;
- `learner/photo-review.tsx` ;
- `learner/voice/*` (écoute et dictée) ;
- `learner/status-badge.tsx` ;
- `page-header.tsx`.

**Existe dans `apps/site/src/wa`, à porter dans `packages/ui`** :
- `GlowTile` ;
- icônes animées (`wa/ui/icons`) ;
- jetons de mouvement (`motion/tokens.ts`) ;
- styles `glow.css` et `tokens.css` ;
- cadre biseauté `tk-frame`.

| Composant | Rôle pour un collégien | État |
|---|---|---|
| **Bulle de discussion** (`ChatBubble`, `ChatThread`, `ChatComposer`) | Prof IA et messagerie avec un même langage : avatar, regroupement, formules, actions (écouter), entrée animée | **Manque** comme composant partagé. La bulle actuelle est privée dans `tutor-chat.tsx`, la messagerie a la sienne (`thread-view.tsx`). |
| **Indicateur « le prof IA réfléchit »** | Avatar animé et points | Partiel : trois points dans `tutor-chat.tsx` |
| **Champ mathématique** (`MathField`) | Saisie MathLive thémée (couleurs Wema, clair et sombre), clavier réduit au collège, lecture seule fiable, retour d'erreur intégré | **À reprendre** : `math.tsx` fonctionne mais n'est pas thémé, a le bug `readOnly` (B2) et utilise le clavier par défaut |
| **Rendu de formule** (`MathText`) | Formules dans énoncés, bulles et cartes | Existe (`math.tsx`), dépend du champ `rendered`. À brancher sur les bulles du prof IA. |
| **Carte d'exercice** (`ExerciseCard`) | Statut coloré, échéance, niveau, aperçu de l'énoncé, action contextuelle (Faire ou Revoir) | **Manque** (Card générique en ligne dans `exercices/page.tsx` et `devoirs/page.tsx`) |
| **Pastille de statut** (`StatusPill`) | À faire, Réussi, En retard, Non vue, En cours, Validé, avec icône | Partiel : `status-badge.tsx` pour les notions ; les devoirs utilisent `Badge` noir |
| **Sélecteur de format** (`FormatTiles`) | 4 tuiles-icônes colorées et « conseillé » | Partiel : `format-picker.tsx` sur ToggleGroup |
| **Pas à pas** (`StepReveal`) | Étapes révélées une à une, animées | Partiel (liste `ol` dans `exercise-player.tsx`) |
| **Retour de réussite ou d'échec** (`AnswerFeedback`) | Réussite : coche qui se dessine, confettis jaunes discrets (respectant `prefers-reduced-motion`), son optionnel, +XP. Échec : secousse légère du champ, nombre d'essais restants en cœurs ou points. | **Manque** (blocs statiques) |
| **Progression gamifiée** (`ProgressRing`, `StreakBadge`, `XpCounter`) | Anneau animé, série de jours, compteur | **Manque** (`Progress` linéaire seulement ; aucune notion de série ni de points côté API) |
| **Chemin de notions** (`NotionPath`, `NotionNode`) | Chemin de jeu avec nœuds, verrous, « Tu es ici » | Partiel (liste verticale dans `progression/page.tsx`) |
| **Carte de notion** (`NotionCard`) | Nom, matière, maîtrise en anneau, action « Travailler » | **Manque** (cartes en ligne dans le profil et le chemin) |
| **Tuiles de choix** (`ChoiceTiles`) | Modes du prof IA, canaux de notification | **Manque** (RadioGroup brut) |
| **Téléversement photo** (`PhotoDrop`) | Zone illustrée, aperçu, recadrage, animation de lecture | Partiel (`photo-review.tsx`, boutons simples) |
| **Lecteur audio** (`AudioPlayer`) | Gros bouton, ondes, vitesse | Partiel (`listen-button.tsx`, synthèse vocale) |
| **BD** (`ComicPanel`, `SpeechBubble`) | Cases biseautées, bulles à pointe, personnages et décors variés | Existe (`comics.tsx`), visuellement minimal |
| **Calendrier** | Semaine, mois, année ; vue liste sur mobile | Existe (`agenda/views.tsx`). Manquent la vue liste mobile et les couleurs par statut. |
| **Sélecteur de créneau** (`SlotPicker`) | Grille de créneaux avec prof | Partiel (dans `family-agenda.tsx`) |
| **État vide** (`EmptyState`) | Illustration, message, action | **Manque** (simples paragraphes gris partout) |
| **Page introuvable intégrée** (`NotFoundInline`) | Exercice ou séance absents | **Manque** |
| **Barre d'onglets mobile** (`BottomNav`) | Navigation au pouce | **Manque** (seulement le tiroir `sidebar`) |
| **`GlowTile`, icônes animées, cadre biseauté** | Langage du site | Dans `apps/site` uniquement : **à déplacer dans `packages/ui`** |
| **Toast de confirmation** | « Préférences enregistrées » | Existe (`sonner`), à utiliser dans `preferences-form.tsx` |

**Animations utiles**, toutes sous `prefers-reduced-motion` :
- titres en fondu et montée de 8 px ;
- cartes en entrée décalée de 40 ms ;
- anneau de progression qui se remplit ;
- coche de réussite tracée en SVG ;
- confettis courts ;
- nœud « Tu es ici » en pulsation ;
- bulles du prof IA en glissement ;
- avatar du prof IA qui « respire » pendant la génération ;
- squelette de BD pendant la génération ;
- icônes de navigation animées au survol.
