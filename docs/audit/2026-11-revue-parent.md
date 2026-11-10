# Revue de l'espace parent et du compte — novembre 2026

- Date : 10 novembre 2026. Production : https://wema.winneragency.co/app.
- Compte : `parent@wema.test` (Parent Démo, un enfant : Élève Un, Collège démo, 4e A Maths, France).
- Méthode : un script Playwright (Chromium) a parcouru toutes les pages en suivant les liens, puis un second script a ouvert les menus, les dialogues et les vues.
  - Chaque page est capturée à 1440 × 900 et à 390 × 844.
  - Le script relève la console, les réponses réseau ≥ 400, le défilement horizontal et le texte brut.
- Lecture seule. Les seules requêtes non GET ont été la connexion et la déconnexion.
  - Effet de bord : le test du bouton « Télécharger (JSON) » a créé une ligne « Export des données » (10/11/2026 14:29:45) dans le journal d'audit. C'est le comportement attendu.
- Captures : `/private/tmp/claude-501/-Users-olivierkakpo-dev-Projet-de-prof-particulier-IA/6fb95da0-1112-4cce-aaac-04134c293912/scratchpad/audit/parent/` (appelé `…/parent/` ci-dessous).

**Bilan technique** : aucune erreur de console et aucune réponse 4xx ou 5xx sur les pages réelles. Seules les deux URL inventées volontairement renvoient un 404, qui est propre. Aucune clé i18n, aucun `undefined`, `null` ni `NaN` affiché, et aucun chargement infini. Les problèmes portent sur la mise en page mobile, la cohérence des données affichées et l'UX.

---

## 1. Pages visitées

| Route                                      | Ce qu'on y fait                                                                                                                                                                                                | Captures (`…/parent/`)                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `/parent`                                  | Accueil « Mes enfants » : une carte par enfant avec les notions (validées, en cours, à travailler), les devoirs (à faire, en retard, rendus) et les prochaines étapes                                          | `parent-1440.png`, `parent-390.png`, `int-focus.png`                                                            |
| `/parent/enfants/[orgId]/[learnerId]`      | Fiche de l'enfant : hypothèses (confiance, source, preuves), progression par notion, « Sa façon d'apprendre » (Oui/Non), centres d'intérêt, besoins particuliers et consentement, partage avec l'établissement | `parent_enfants_37ecef62_…-1440.png` / `-390.png`, `int-needs-select.png`                                       |
| `/parent/agenda`                           | Prochaines séances, calendrier semaine, mois et année, dialogue « Réserver une séance »                                                                                                                        | `parent_agenda-1440.png` / `-390.png`, `int-agenda-reserver.png`, `int-agenda-Mois.png`, `int-agenda-Année.png` |
| `/parent/agenda/seances/[id]`              | Détail d'une séance. Aucune séance n'existe pour ce compte, donc seule la page 404 a été vue                                                                                                                   | `parent_agenda_seances_0000…-1440.png`                                                                          |
| `/parent/messages`                         | Messagerie (liste vide) et dialogue « Nouveau message »                                                                                                                                                        | `parent_messages-1440.png` / `-390.png`, `int-messages-new.png`                                                 |
| `/parent/abonnements`                      | Abonnement par matière et par enfant, derniers paiements                                                                                                                                                       | `parent_abonnements-1440.png` / `-390.png`                                                                      |
| `/parent/abonnements/retour`               | Retour de paiement : sans paramètre, puis avec un paramètre inconnu                                                                                                                                            | `parent_abonnements_retour-1440.png`, `int-retour-fake.png`                                                     |
| `/parent/famille`                          | Membres de la famille, programmes des enfants (« Modifier le programme »), ajout d'un enfant, liens parent-enfant                                                                                              | `parent_famille-1440.png` / `-390.png`, `int-famille-programme.png`                                             |
| `/compte`                                  | Compte, export JSON, consentement parental, export et suppression du compte d'un enfant, suppression de son propre compte                                                                                      | `compte-1440.png` / `-390.png`, `int-compte-after-dl.png`                                                       |
| `/compte/notifications`                    | Canaux des relances et des messages, heures calmes, fuseau horaire, derniers envois                                                                                                                            | `compte_notifications-1440.png` / `-390.png`                                                                    |
| `/compte/conditions`                       | Acceptation des conditions (carte au style du site)                                                                                                                                                            | `compte_conditions-1440.png` / `-390.png`                                                                       |
| `/compte/notifications/desinscription`     | Confirmation de désinscription. Sans lien signé, on voit « Lien invalide »                                                                                                                                     | `compte_notifications_desinscription-1440.png`                                                                  |
| Menu du compte, tiroir mobile, déconnexion | Le menu propose « Mon compte », « Notifications », « Nuit (sombre) » et « Se déconnecter ». Le parent n'a qu'un espace : pas de menu « changer d'espace » (la flèche est masquée, ce qui est correct)          | `int-account-menu.png`, `int-space-switch.png`, `int-mobile-drawer.png`, `int-after-logout.png`                 |

- **Déconnexion** : elle fonctionne. `POST /api/auth/logout` renvoie vers `/app/connexion`, et revisiter `/app/parent` renvoie de nouveau vers `/connexion`.
- **Export** : `wema-mes-donnees.json` se télécharge correctement.

---

## 2. Erreurs et bugs

### Bloquant

Aucun constaté.

### Gênant

1. **Défilement horizontal sur `/parent/famille` en mobile (422 px pour 390 px).**
   - Reproduire : ouvrir la page à 390 px de large.
   - Deux causes :
     - la pastille du programme (« Mathématiques · 4e · France · suivi par la classe 4e A · Maths ») ne revient pas à la ligne et sort de sa carte ;
     - le tableau des membres coupe la colonne « Connexion » et cache entièrement la colonne « Actions ».
   - Sources : `src/components/guardian/child-programs.tsx` (le `Badge` n'a ni `whitespace-normal` ni `max-w-full`) et le tableau de `src/app/parent/famille/page.tsx`.
2. **« Abonnements » dit « Aucune matière pour l'instant » alors que l'enfant suit les Maths.**
   - Juste au-dessus, la page annonce « toutes les matières sont incluses ».
   - La liste « Matières suivies » ne lit que `child.subscriptions`, c'est-à-dire les abonnements payés.
   - Un parent sous contrat a l'impression que rien n'est actif.
   - Source : `src/app/parent/abonnements/page.tsx`, lignes 56 à 70.
3. **« Modifier le programme » (`/parent/famille`) ouvre un sélecteur vide** (« Choisir un pays », « Choisir une classe »), alors que l'enfant a un programme France, 4e.
   - Le sélecteur ne porte que sur les programmes « individuels ». Ceux qui viennent de la classe ne sont ni repris ni expliqués.
   - « Enregistrer le programme » reste actif même si rien n'est choisi.
   - Source : `src/components/guardian/child-programs.tsx`, lignes 23 à 30.
4. **Retour de paiement sans issue.** Sans paramètre `paiement`, `/parent/abonnements/retour` n'affiche que « Paiement introuvable. », sans bouton de retour vers les abonnements. Le cas qui suit, lui, a un bouton.
   - Source : `src/app/parent/abonnements/retour/page.tsx`, branche `missing`.
5. **Les hypothèses à 35 % de confiance sont étiquetées « Plutôt vraie »** sur un badge noir plein.
   - Les six hypothèses de la fiche sont toutes « Plutôt vraie », confiance 35 %, une seule preuve.
   - Le libellé contredit la jauge et le texte d'introduction (« pas des certitudes »).
   - Sources : `messages/fr/guardian.json` (`hypothesisStatus.supported`) et `src/components/guardian/hypotheses-list.tsx`, ligne 23.

### Cosmétique

6. **Accord fautif : « 1 réussies sur les 2 dernières »** (fiche de l'enfant, progression).
   - Le pluriel suit `total` au lieu de `correct`.
   - Source : `messages/fr/guardian.json`, ligne 70 (`profile.recent`).
7. **« Prof de Élève Un · 4e A · Maths »** dans le dialogue « Nouveau message » : l'élision est absente (il faudrait « d'Élève Un »).
   - La reformulation « Prof · Élève Un · 4e A Maths » évite le problème.
   - Source : `messages/fr/messages.json`, ligne 17 (`teacherOfChild`).
8. **`/compte/conditions` affiche le formulaire d'acceptation même quand les conditions en vigueur sont déjà acceptées** (le 6 novembre 2026).
   - La page devrait rediriger, ou dire « Vous avez déjà accepté la version 2026-11-03 ».
   - Source : `src/app/compte/conditions/page.tsx`.
9. **Les pastilles à zéro ont la même couleur vive que les autres** (accueil) : « 0 à travailler » apparaît en rouge-orange et « 0 validée » en noir.
   - Une valeur nulle devrait être grisée.
   - Source : `src/components/guardian/child-card.tsx` et `status-chip.tsx`.
10. **Agenda en mobile** : la vue semaine montre trois jours sur sept et défile à l'intérieur de la carte (`min-w-[760px]`), sans aucun indice qu'il en reste.
    - Les échéances sont tronquées (« 16:36 À … »).
    - Source : `src/components/agenda/views.tsx`.
11. **Le dialogue « Réserver une séance » couvre une autre semaine que le calendrier** :
    - le dialogue va du mardi 10 au lundi 16 novembre ;
    - le calendrier va du lundi 9 au dimanche 15 novembre.
    - Le dialogue n'indique ni l'enfant ni le prof concernés.
    - Avec « Aucun créneau libre cette semaine », il ne propose pas d'aller directement à la prochaine semaine disponible.
12. **La colonne « Actions » du tableau des membres (famille) est vide** pour les deux lignes. L'en-tête reste affiché sans contenu.
13. **Mise en page incohérente du compte** :
    - `/compte` a un en-tête avec logo et « Retour à Wema » à droite ;
    - `/compte/notifications` a seulement « ← Retour à Wema » à gauche, sans logo ;
    - aucune de ces deux pages ne reprend la barre latérale de l'espace.

---

## 3. Problèmes d'UX et propositions

| Problème constaté                                                                                                                                                                                                   | Proposition                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L'accueil parent ne dit ni quelle matière, ni quand l'enfant a travaillé pour la dernière fois, ni s'il y a une alerte. « Prochaines étapes » est générique (« S'entraîner encore un peu sur une notion en cours ») | Afficher en tête de carte la dernière activité (« il y a 2 j ») et la matière. Nommer la notion dans les prochaines étapes et ajouter une mini-courbe de progression sur sept jours               |
| Sur la fiche de l'enfant, « Ce que Wema a compris » et « Sa façon d'apprendre » répètent les mêmes items (« Comprend mieux avec des exemples concrets »…) dans deux blocs éloignés                                  | Fusionner les deux : chaque hypothèse porte directement ses boutons « C'est juste / Pas du tout »                                                                                                 |
| « Manque de confiance en soi » et « A confiance en soi » sont deux bascules indépendantes : on peut répondre « Oui » aux deux                                                                                       | Une seule question à trois choix (manque de confiance / à l'aise / je ne sais pas)                                                                                                                |
| Une bascule « Oui/Non » enregistre sans retour visible                                                                                                                                                              | Afficher un toast « Enregistré » et un état intermédiaire sur la bascule                                                                                                                          |
| La progression est une simple liste, sans visualisation                                                                                                                                                             | Une barre de maîtrise par notion, avec un graphique Recharts (courbe ou barres) de l'évolution par matière                                                                                        |
| Le formulaire « Besoins particuliers » est clair (encart « Vous gardez la main »), mais l'interrupteur « Partage avec ses établissements » n'a pas de libellé d'action visible                                      | Ajouter un libellé explicite à droite (« Partager »), et une confirmation au moment d'activer le partage d'une donnée de santé                                                                    |
| Sur `/compte`, « Donner mon consentement », « Télécharger ses données » et « Demander la suppression de son compte » se suivent sans hiérarchie, et la suppression est au même niveau que le reste                  | Découper en sous-cartes « Consentement », « Données » et « Zone sensible ». Mettre la suppression dans une zone rouge discrète avec un dialogue de confirmation qui rappelle le délai de 30 jours |
| Boutons désactivés incohérents : « Donner mon consentement » est gris foncé (primaire désactivé), « Demander la suppression » est gris clair (contour désactivé)                                                    | Un seul style de bouton désactivé, accompagné d'une infobulle « Cochez la case d'abord »                                                                                                          |
| `/parent/famille` regroupe quatre outils sur une seule page longue (membres, programmes, ajout d'un enfant, liens). Le formulaire « Ajouter un enfant » est toujours déplié                                         | Faire de « Ajouter un enfant » un bouton qui ouvre un dialogue ou une feuille en étapes (prénom → connexion → pays et classe → consentement). Mettre les liens parent-enfant dans un onglet       |
| Agenda : « Prochaines séances » vide occupe une grande carte                                                                                                                                                        | Remplacer par un état vide illustré avec le bouton « Réserver une séance ». Afficher les échéances de devoirs dans la grille aux bonnes heures, et pas seulement en bandeau « toute la journée »  |
| Messagerie vide : « Aucune conversation pour l'instant. » et une grande carte blanche en mobile                                                                                                                     | Un état vide qui explique avec qui on peut écrire (« Le prof de Maths d'Élève Un ») et un bouton direct                                                                                           |
| Notifications : le fuseau est une liste de plusieurs centaines d'identifiants IANA bruts (`Africa/Asmera`…). Les heures calmes sont deux listes de 24 heures                                                        | Une liste avec recherche, groupée par pays, avec le libellé en clair (« Bénin — Porto-Novo (UTC+1) »). Pour les heures calmes, une plage visuelle (curseur double)                                |
| Abonnements (enfant sous contrat) : il n'y a rien à faire, mais la page ne montre aucune valeur                                                                                                                     | Montrer les matières incluses par le contrat avec leur prof IA, et un badge « Offert par Collège démo »                                                                                           |

---

## 4. Refonte visuelle page par page

Référence : `apps/web/src/app/connexion/auth-card.tsx` et `auth.css` (cadre biseauté `tk-frame`, étiquette Geist Mono en majuscules « ESPACE WEMA », bouton jaune `#FFC529`, fond papier grainé).

L'application paraît aujourd'hui « gabarit shadcn » :
- cartes blanches à bord beige et ombre légère, toutes identiques ;
- titres en gras sombre ;
- pastilles plates ;
- icônes Phosphor fines et monochromes dans la barre latérale ;
- aucun mouvement.

L'écart est net avec l'écran `/compte/conditions`, déjà restylé (`compte_conditions-1440.png`).

**Commun à tout l'espace (coquille)**
- **Barre latérale** :
  - remplacer le carré « W » par le `wema-logo` du site ;
  - mettre l'espace (« PARENT ») en étiquette Geist Mono majuscule ;
  - donner à chaque entrée une `GlowTile` de 28 px avec l'icône animée du site (`apps/site/src/wa/ui/icons` : `house`, `users-three`, `bell`, `credit-card`, `envelope`…) en couleur ;
  - marquer l'entrée active par un fond jaune pâle et un liseré à gauche.
- **En-tête de page** :
  - titre Geist en graisse légère (300 ou 400), grande taille ;
  - sur-titre mono (« 01 — MES ENFANTS ») ;
  - apparition du titre mot par mot (fondu et légère montée, 300 ms), comme sur le site.
- **Cartes** :
  - arrondi doux de 16 à 20 px plutôt que des angles droits ;
  - un seul coin biseauté (en bas à droite) réservé aux cartes « héros » ;
  - le fond papier grainé reste visible autour.
- **Pied de page légal** : passer les liens en Geist Mono, comme sur l'écran des conditions.

**`/parent` (accueil)**
- Faire de la carte enfant une « carte héros » : avatar (initiales sur pastille jaune) et nom en Geist léger, avec une ligne mono « 4E · COLLÈGE DÉMO · MATHS ».
- Montrer les compteurs de notions en anneau ou en barre segmentée tricolore, plutôt que trois pastilles.
- Pour les devoirs, trois tuiles avec une `GlowTile` (horloge ambre pour « à faire », alerte rouge pour « en retard », coche verte pour « rendus ») et un chiffre animé au chargement.
- Mettre les prochaines étapes en liste avec une icône par type (`easy_win`, `spaced_review`…).
- Bouton principal « Voir la fiche » en jaune.

**Fiche de l'enfant**
- Carte d'hypothèse :
  - badge d'état à trois couleurs (vert, ambre, gris) au lieu du noir plein ;
  - jauge de confiance fine et dégradée ;
  - source et preuves en étiquettes mono ;
  - icône selon la source (prof IA, parent, prof, exercices).
- Progression : carte de notion avec une barre de maîtrise et une pastille d'état, plus un petit graphique par matière.
- Préférences : remplacer le `ToggleGroup` « Oui/Non » par des puces à bascule arrondies avec une coche animée.
- Besoins particuliers : garder l'encart « Vous gardez la main » mais le restyler en encadré biseauté avec une `GlowTile` bouclier verte.

**`/parent/agenda`**
- Bandeau de navigation (flèches, « Aujourd'hui », plage de dates) avec la plage en Geist léger et le sélecteur Semaine/Mois/Année en segment jaune.
- Événements en pastilles arrondies colorées par type (séance en jaune, devoir en violet clair) avec une icône.
- Ligne « maintenant » rouge sur la vue semaine.
- En mobile, une vue jour ou liste par défaut à la place de la grille de sept colonnes.

**`/parent/messages`**
- Mise en page deux colonnes : liste de fils avec avatar et aperçu, puis le fil.
- Bulles arrondies (jaune pour soi, papier pour l'autre).
- État vide illustré.

**`/parent/abonnements`**
- Une carte par enfant avec, pour chaque matière, une « carte de matière » (`GlowTile` de la matière, prix ou « Inclus », état).
- Tunnel de paiement :
  - choix carte ou Mobile Money en grandes tuiles sélectionnables avec logo ;
  - récapitulatif à droite ;
  - écran de retour avec une animation de succès (coche qui se dessine), d'attente (anneau) ou d'échec.
- Historique en tableau sobre : montants en chiffres tabulaires, statut en pastille.

**`/parent/famille`**
- Membres affichés en cartes, pas en tableau, sur mobile.
- Rôles en pastilles.
- Ajout d'un enfant dans une feuille latérale en étapes avec un indicateur de progression.

**`/compte` et `/compte/notifications`**
- Réutiliser la coquille de l'espace (barre latérale) ou un en-tête identique à celui du site.
- Sections avec une `GlowTile` : compte (utilisateur bleu), données (base de données violette), enfants (groupe jaune), suppression (corbeille rouge).
- Canaux de notification en tuiles cliquables avec icône (cloche, enveloppe, WhatsApp, SMS) plutôt qu'en boutons radio.

---

## 5. Composants nécessaires

| Composant                                                  | Existe dans `packages/ui` ?                                                                                       | À faire                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Coquille, barre latérale, menu de compte et d'espace       | Oui : `sidebar.tsx`, `dropdown-menu.tsx`, `avatar.tsx`                                                            | Restyler (`GlowTile`, logo, étiquettes mono)                                          |
| Carte et carte héros biseautée                             | `card.tsx` (shadcn), sans variante biseautée                                                                      | Ajouter les variantes `frame` et `hero` reprises de `tk-frame`                        |
| Pastille d'icône colorée (`GlowTile`) et icônes animées    | Non : seulement dans `apps/site/src/wa/ui/components/ui/glow-tile.tsx` et `wa/ui/icons`                           | Les déplacer dans `packages/ui` pour les partager entre le site et l'application      |
| Badge et puce d'état (notion, hypothèse, paiement)         | `badge.tsx`                                                                                                       | Variantes sémantiques (succès, attention, danger, neutre, nul)                        |
| Jauge ou anneau de progression                             | `progress.tsx` (barre simple)                                                                                     | Anneau, barre segmentée tricolore, jauge de confiance                                 |
| Graphique de progression                                   | Oui : `chart.tsx` et `recharts.tsx` (Recharts 3.8), utilisés seulement dans `components/school/mastery-chart.tsx` | Courbe de maîtrise par matière pour la fiche enfant                                   |
| Calendrier (semaine, mois, année)                          | Non : il est propre à l'application, dans `apps/web/src/components/agenda/calendar.tsx` et `views.tsx`            | Restyler, ajouter une vue liste en mobile et la ligne « maintenant »                  |
| Bulle de discussion, liste de fils, zone de saisie         | Non : `apps/web/src/components/messages/*`                                                                        | Bulles arrondies, avatars, horodatage mono                                            |
| Interrupteur, bascule Oui/Non, segment                     | `switch.tsx`, `toggle-group.tsx`                                                                                  | Restyler (jaune, coche animée)                                                        |
| Tuiles de choix (moyen de paiement, canal de notification) | Non (`radio-group.tsx` est basique)                                                                               | Composant `ChoiceTile` (radio sous forme de carte, icône, état sélectionné)           |
| Formulaire en étapes, feuille latérale                     | `sheet.tsx`, `dialog.tsx`                                                                                         | Ajouter un indicateur d'étapes                                                        |
| Zone sensible et confirmation de suppression               | `dialog.tsx`, `alert.tsx`                                                                                         | Modèle `DangerZone` avec saisie de confirmation                                       |
| État vide illustré                                         | Non (simples paragraphes gris)                                                                                    | Composant `EmptyState` avec icône animée, texte et action                             |
| Tableau responsive (cartes en mobile)                      | `table.tsx`                                                                                                       | Variante qui passe en cartes sous 640 px (corrige le défilement de `/parent/famille`) |
| Toast d'enregistrement                                     | `sonner.tsx`                                                                                                      | L'utiliser après chaque bascule de préférence                                         |
| Liste avec recherche (fuseau horaire)                      | `command.tsx` et `popover.tsx`                                                                                    | Combobox « fuseau » groupée par pays                                                  |
