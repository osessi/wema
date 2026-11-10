# Revue du back-office (super admin) — novembre 2026

- Date : 10 novembre 2026. Production : https://wema.winneragency.co/app/admin.
- Compte : le super admin (identifiants de `infra/.env.coolify`).
- Méthode : un script Playwright (Chromium) a parcouru toutes les pages en suivant les liens, puis un second script a ouvert les onglets, les panneaux, les menus et les détails.
  - Chaque page est capturée à 1440 × 900 et à 390 × 844.
  - Le script relève la console, les réponses réseau ≥ 400, le défilement horizontal et le texte brut.
- **Lecture seule stricte** :
  - un garde-fou du script annulait toute requête `/api` autre que GET, hors connexion et déconnexion ;
  - aucune requête n'a été bloquée, donc aucune n'a été tentée ;
  - aucun réglage, rôle, offre, contrat ou modèle d'IA n'a été touché ;
  - « Recalculer maintenant », « Enregistrer », « Créer », les interrupteurs et les « × » de rôle n'ont jamais été cliqués.
- Captures : `/private/tmp/claude-501/-Users-olivierkakpo-dev-Projet-de-prof-particulier-IA/6fb95da0-1112-4cce-aaac-04134c293912/scratchpad/audit/admin/` (appelé `…/admin/` ci-dessous).

**Bilan technique** :
- aucune erreur de console, aucune réponse 4xx ou 5xx, aucun chargement infini ;
- temps de réponse entre 1,4 et 2,5 s par page ;
- deux pages défilent horizontalement en mobile ;
- plusieurs textes techniques bruts restent visibles : identifiants de tâches d'IA, types d'entités en anglais, JSON, bouton de fichier en anglais.

---

## 1. Pages visitées

| Route | Ce qu'on y fait | Captures (`…/admin/`) |
|---|---|---|
| `/admin` | Accueil : 10 cartes de raccourci vers chaque section | `admin-1440.png` / `-390.png` |
| `/admin/referentiel` | Liste des pays (Bénin, France) et création d'un pays | `admin_referentiel-1440.png` / `-390.png` |
| `/admin/referentiel/[countryId]` (Bénin, France) | Programmes (classe × matière), classes, import et export YAML ou CSV, import en masse d'exercices, réglages du pays | `admin_referentiel_7a4cfd6f_…-1440.png`, `admin_referentiel_51440d2d_…-1440.png` (et `-390`) |
| `/admin/referentiel/[c]/programmes/[p]` (Bénin 5e et 4e) | Éditeur de programme : unités, notions, panneau d'une notion (fiche, prérequis, idées fausses, case « Validée par un enseignant du pays »), éléments archivés | `admin_referentiel_…_programmes_d7b57f10_ae20_-1440.png`, `…fb012aba…`, `int-notion-panel.png`, `int-nouvelle-notion.png`, `int-unit-edit.png`, `int-archived.png`, `int-prog-390.png` |
| `/admin/matieres` | Matières (seulement `maths`), modification, archivage et création | `admin_matieres-1440.png`, `int-matiere-edit.png` |
| `/admin/organisations` | Liste des organisations (Wema, Collège démo, Famille démo) et création | `admin_organisations-1440.png` / `-390.png` |
| `/admin/organisations/[id]` (Wema, Collège démo) | Onglets « Membres » (rôles en ligne, ajout d'un membre) et « Rôles » (permissions à cocher) | `admin_organisations_ecd1e8b3_…`, `admin_organisations_89880e13_…`, `int-org-roles.png`, `int-org-390.png` |
| `/admin/reglages` | Seuils des statuts de notion, paramètres BKT, confidentialité et conservation, versions des conditions | `admin_reglages-1440.png`, `int-reglages.png` |
| `/admin/ia` | Routage IA : fournisseur, paliers, exceptions par tâche, consommation sur 30 jours | `admin_ia-1440.png` / `-390.png` |
| `/admin/journal` | Journal d'audit (60 lignes, « Détails » dépliables) | `admin_journal-1440.png`, `int-journal-details.png`, `int-journal-390.png` |
| `/admin/offres` | Moyens de paiement branchés, offres (aucune), nouvelle offre, contrats, abonnements, paiements | `admin_offres-1440.png`, `int-offres.png` |
| `/admin/collectif` (avec `?pays=`) | Apprentissage collectif : filtres par pays, aucune notion au-dessus du seuil de 10 élèves | `admin_collectif-1440.png`, `int-collectif-fr.png` |
| `/admin/couts` | Coûts de l'IA : chiffres clés, plafonds, coûts par jour, matière, tâche, modèle et organisation | `admin_couts-1440.png`, `admin_couts-390.png` |
| `/admin/contacts` | Demandes de contact (aucune) | `admin_contacts-1440.png`, `int-contacts.png` |
| `/compte` (super admin) | Page compte | `int-compte-admin.png` |
| Menus et déconnexion | Le super admin n'a qu'un espace : pas de menu « changer d'espace » (la flèche est masquée, ce qui est correct) | `int-space-switch.png` |

- **Déconnexion** : elle fonctionne. Elle renvoie vers `/app/connexion`, et revisiter `/app/admin` renvoie de nouveau vers `/connexion`.
- **« Validations d'exercices »** : aucun écran du back-office ne les liste.
  - Elles n'apparaissent que comme lignes du journal (« Exercice créé », « Banque d'exercices proposée », « Exercice retenu dans la banque »).
  - Seul l'import en masse les mentionne, en annonçant que les exercices sont vérifiés par `services/math`.
  - La validation visible dans le référentiel porte sur les **notions** : badge « À valider » ou « Validée par un enseignant du pays ».
  - Voir les problèmes d'UX.

---

## 2. Erreurs et bugs

### Bloquant
Aucun constaté.

### Gênant

1. **Défilement horizontal sur `/admin/couts` en mobile (528 px pour 390 px).**
   - Les cartes « Par tâche » et « Par modèle » ne rétrécissent pas.
   - Les identifiants en police mono (`anthropic/claude-haiku-5.5`, `intake.interview` suivi du badge « essentielle ») forcent la largeur.
   - Dans « Par matière », la colonne « Coût par élève » est coupée.
   - Source : `src/app/admin/couts/page.tsx` (grille à deux colonnes et `Table` sans conteneur défilant ni repli en cartes).
2. **Tableaux coupés en mobile** :
   - `/admin/organisations/[id]` : la colonne « Connexion » est coupée (« E-mail dir… ») ;
   - `/admin/journal` : seules les colonnes Date, Qui et le début d'Action sont visibles, et l'unique ligne dépliée occupe 220 px de vide ;
   - `/admin/ia` : même problème.
   - Ces tableaux défilent dans leur conteneur, sans rien qui l'indique.
   - Sources : `src/app/admin/organisations/[organizationId]/members-panel.tsx`, `src/app/admin/journal/page.tsx`, `src/app/admin/ia/usage-table.tsx`.
3. **L'interrupteur « sous contrat » (`/admin/offres`, « Contrats ») n'a aucun libellé visible et agit sans confirmation.**
   - Un seul clic envoie `PUT /admin/billing/contracts/{id}` et ouvre ou ferme toutes les matières d'une école.
   - L'`aria-label` existe, mais rien n'est écrit à l'écran.
   - Source : `src/app/admin/offres/contract-switch.tsx`.
4. **Le « × » d'une pastille de rôle (organisation, onglet Membres) retire un rôle en un clic**, sans confirmation. C'est l'endroit où l'on peut retirer « Super admin » dans l'organisation Wema.
   - Source : `members-panel.tsx`.
5. **« Par jour » (`/admin/couts`) saute les jours sans dépense** : la liste passe du 6 au 8 novembre.
   - L'échelle de temps est trompeuse. Ce n'est pas un graphique, mais des barres CSS.
   - Source : `src/app/admin/couts/page.tsx`, lignes 59 et 136 à 150.
6. **Formulaire « Nouveau programme » (pays)** : il est prérempli avec « 5e / Mathématiques », une combinaison qui existe déjà. Un clic distrait mène à un doublon ou à une erreur.
   - Source : `src/app/admin/referentiel/[countryId]/program-list.tsx`.

### Cosmétique

7. **Textes techniques non traduits** :
   - noms de tâches d'IA bruts (`tutor.reply`, `exercise.propose`…) sur `/admin/ia` (étiquettes des champs d'exception et tableau) et sur `/admin/couts` ;
   - types d'entités en anglais dans la colonne « Cible » du journal (`account · 6bfb9bcc`, `exercise · 9da838b8`, `assignment · …`) ;
   - « Détails » du journal affichés en JSON brut (`{"week": …, "source": "ai", "intentId": …}`).
8. **Le bouton de fichier natif est en anglais : « Choose File No file chosen »** (import référentiel et import d'exercices).
   - Source : `src/app/admin/referentiel/[countryId]/curriculum-transfer.tsx`, ligne 93 (`<input type="file">` non habillé).
9. **Aide en double sur « Import en masse d'exercices »** : la phrase « Liste YAML au format de content/exercises… » apparaît deux fois, en description puis sous le champ.
   - Le libellé « Contenu » et l'aide sont rendus en police mono, contrairement aux autres champs.
10. **Nombres mal formatés** :
    - latence sans séparateur (« 15232 ms ») alors que les jetons en ont un (« 45 717 »). Source : `messages/fr/back-office.json`, ligne 510 (`"{value} ms"` au lieu de `{value, number}`) ;
    - réglages en notation anglaise (« 0.5 », « 0.95 », « 0.15 »).
11. **Dates hétérogènes** : `10/11/2026 14:29:45` dans le journal, `10 nov. 2026, 03:40` dans « collectif », `6 nov.` dans « coûts ».
12. **Désalignements de grille** :
    - `/admin/offres` : les champs « Devise » et « Prix » ne sont pas sur la même ligne de base que « Période » et « Essai gratuit » ;
    - `/admin/reglages` : « Seuil « Validé » » est décalé par rapport à « Seuil « En cours » » ; « Journal des envois » et « Conversations… » sont mal alignés.
    - La cause est la longueur des aides, qui pousse les champs.
13. **« Active » (offre) est rangé dans le groupe « Moyens de paiement »**, à côté de « Carte bancaire » et « Mobile Money ».
14. **Deux styles pour deux boutons « Enregistrer » sur `/admin/reglages`** :
    - le premier est noir et placé hors carte (statuts et BKT) ;
    - le second est beige et placé dans la carte (confidentialité).
15. **Onglets organisation** : l'onglet actif « Rôles » prend un épais contour noir de focus après le clic (`int-org-roles.png`).
16. **Sous-titre de la page pays peu utile** : sous « Bénin (BJ) », on lit seulement « Situations d'apprentissage », c'est-à-dire le nom des unités.

---

## 3. Problèmes d'UX et propositions

| Problème constaté | Proposition |
|---|---|
| L'accueil `/admin` n'est qu'un sommaire de 10 cartes de texte, sans aucun chiffre | En faire un vrai tableau de bord : élèves actifs, coût de l'IA du mois avec courbe (Recharts), notions « à valider » (les 13 notions vues, Bénin 4e et 5e, sont toutes « À valider »), demandes de contact non traitées, dernières actions du journal, état des moyens de paiement (« Non branché ») |
| Journal : 60 lignes, sans filtre, sans pagination ni recherche. La cible n'est pas cliquable | Ajouter des filtres (acteur, action, type, période) et une pagination. Rendre la cible cliquable (vers l'exercice, l'organisation…). Afficher les détails en paires clé–valeur traduites dans un panneau latéral |
| Validation des contenus : rien ne regroupe ce qui attend une validation. Les notions « À valider » sont dispersées par unité. Les exercices proposés par l'IA et retenus ou écartés n'ont pas d'écran | Une page « À valider » avec deux files : notions et exercices de la banque. Chaque élément montre le résultat de `services/math`, qui l'a proposé, et les actions Valider / Écarter. Ajouter un compteur dans la barre latérale |
| Éditeur de programme : une notion se déplie dans la liste, avec trois boutons d'enregistrement distincts (fiche, prérequis, idées fausses). La liste des prérequis affiche les 34 notions du pays en cases à cocher | Ouvrir la notion dans une feuille latérale à onglets, avec un seul enregistrement par onglet et une alerte « modifications non enregistrées ». Choisir les prérequis dans une combobox avec recherche, et afficher un mini-graphe des dépendances |
| « Nouvelle notion » et « Nouvelle unité » sont toujours affichés ou dépliés en bas de chaque unité | Bouton « + » discret sur chaque unité. Réordonner les notions par glisser-déposer plutôt qu'avec le champ « Ordre » |
| L'import YAML ou CSV est un grand formulaire toujours affiché | Une zone de dépôt de fichier, un aperçu du différentiel (créé, modifié, ignoré) puis une confirmation. C'est déjà le principe de « Voir les changements » : le mettre en scène dans un dialogue en étapes |
| Organisation, onglet Membres : chaque ligne contient un sélecteur « Ajouter un rôle » et son bouton. En mobile, chaque ligne fait 140 px | Un menu « ⋯ » par ligne (ajouter ou retirer un rôle avec confirmation). Mettre « Ajouter un membre » dans un dialogue |
| Rôles : dans une école, la grille montre aussi les permissions qui n'ont « d'effet que dans l'organisation Wema » | Masquer ces permissions hors de l'organisation Wema, ou les replier sous « Permissions plateforme » |
| Routage IA : les paliers sont des champs texte libres (« identifiants séparés par des virgules »). Une faute de frappe casse le routage | Une liste ordonnée de modèles (puces déplaçables) avec validation en direct, et un libellé lisible pour chaque tâche (« Réponse du prof IA » plutôt que `tutor.reply`) |
| Routage IA et Coûts affichent le même tableau de consommation | Garder le détail dans « Coûts » et mettre un simple lien dans « Routage » |
| Coûts : « Par matière » totalise 0,0071 $ quand le total est de 0,0256 $, sans explication de l'écart | Ajouter une ligne « Non attribué à une matière » |
| Plafonds : le formulaire est prérempli (50 $, 80 %) alors qu'« Aucun plafond » n'existe | Champs vides avec exemple en placeholder, ou bouton « Créer un plafond » |
| Offres : la carte et le Mobile Money sont « Non branché sur ce serveur », mais on peut quand même les cocher sur une offre | Désactiver ces cases, ou afficher un avertissement « non branché : les parents ne pourront pas payer ainsi » |
| Prix saisi en « plus petite unité » (2900 = 29,00 €) | Saisir le prix en unités normales et afficher l'aperçu formaté (« 29,00 € / mois ») à côté |
| Réglages pédagogiques : changer un seuil recalcule tout l'historique | Un dialogue de confirmation qui résume l'impact (« s'applique à N élèves »). Utiliser des curseurs pour les probabilités entre 0 et 1, avec la valeur par défaut affichée |
| « Recalculer maintenant » (collectif) n'est accompagné d'aucune information sur la durée ou l'état | Un état « calcul en cours » et l'heure du dernier calcul mise à jour |
| Collectif : un état vide sans contexte | Afficher le nombre actuel d'élèves par notion la plus avancée (« 3/10 sur Équations du 1er degré ») |

---

## 4. Refonte visuelle page par page

L'écart avec le site est le même que dans les autres espaces : des cartes shadcn blanches toutes identiques, des icônes Phosphor fines et monochromes, des tableaux bruts, aucun mouvement. Le back-office peut rester plus dense que l'application élève, mais doit garder la même identité :
- sur-titres et identifiants en Geist Mono ;
- titres légers ;
- pastilles d'icônes colorées ;
- arrondis doux (12 à 16 px), avec le biseau réservé aux cartes de synthèse.

**Coquille**
- Le même traitement que dans les autres espaces : `GlowTile` colorée par section (référentiel violet, matières bleu, organisations vert, réglages gris, IA jaune, journal ardoise, offres orange, collectif turquoise, coûts rouge, contacts rose).
- Regrouper la navigation en trois blocs titrés en mono : CONTENU (référentiel, matières, à valider), PLATEFORME (organisations, offres, contacts), PILOTAGE (IA, coûts, collectif, réglages, journal).
- Mettre des pastilles de compteur sur « Demandes de contact » et « À valider ».

**`/admin` (accueil)**
- Une rangée de 4 chiffres clés : tuiles biseautées, chiffre en Geist léger animé au chargement, petite courbe sur 30 jours.
- En dessous, deux colonnes : « À traiter » (liste avec icônes) et « Activité récente » (extrait du journal).

**Référentiel (`/admin/referentiel`, pays, programme)**
- Pays : chaque pays en carte avec drapeau ou code en grande étiquette mono (`BJ`, `FR`), et le nombre de classes, de programmes et de notions.
- Programmes : une grille de tuiles classe × matière avec le nombre de notions et une jauge « validées / total ».
- Éditeur :
  - unités en sections repliables, avec le numéro en mono (« SA 01 ») ;
  - notions en « cartes de notion » (code mono, nom, pastille d'état verte « Validée » ou ambre « À valider ») ;
  - au survol, la poignée de glisser-déposer et le menu « ⋯ » ;
  - panneau de notion en feuille latérale.

**Organisations**
- Liste en cartes avec une icône de type (école, réseau, famille, plateforme) et le nombre de membres.
- Détail : en-tête de l'organisation avec badge de type et état « sous contrat ».
- Rôles présentés en matrice permissions × rôles plutôt qu'en blocs répétés.

**Réglages pédagogiques**
- Une section par thème avec une `GlowTile`.
- Curseurs pour les probabilités, avec repère de la valeur par défaut.
- Une barre d'enregistrement collante en bas, qui n'apparaît que si quelque chose a changé.

**Routage IA et Coûts**
- Coûts :
  - chiffres clés en tuiles ;
  - « Par jour » en vrai graphique à barres Recharts (avec les jours à zéro) ;
  - répartition par tâche en barres empilées ou en anneau ;
  - plafonds affichés en jauges (dépense du mois sur plafond, avec une couleur d'alerte au seuil).
- Routage : une carte par palier avec les modèles en puces ordonnées.

**Journal**
- Une barre de filtres collante.
- Lignes compactes : icône d'action colorée (création verte, modification bleue, suppression rouge, export violet), acteur avec avatar, cible en lien.
- Détails en panneau latéral.

**Offres et abonnements**
- Moyens de paiement en tuiles avec logo et état (pastille verte « Branché » ou grise « Non branché »).
- Offres en tableau avec un aperçu du prix formaté.
- Contrats en lignes avec un libellé « Sous contrat » visible et une confirmation.

**Collectif et contacts**
- États vides illustrés (icône animée, explication, action).
- Contacts en boîte de réception : liste à gauche, message à droite, statut « traité ».

---

## 5. Composants nécessaires

| Composant | Existe dans `packages/ui` ? | À faire |
|---|---|---|
| Tableau de données (tri, filtres, pagination, repli en cartes en mobile) | `table.tsx` (shadcn, sans logique) | Composant `DataTable` (TanStack Table ou équivalent) avec un mode cartes sous 640 px. Corrige le défilement de `/admin/couts`, du journal et des organisations |
| Graphiques : barres, courbe, anneau, jauge de plafond | Oui : `chart.tsx` et `recharts.tsx` (Recharts 3.8), utilisés seulement dans `apps/web/src/components/school/mastery-chart.tsx`. Aucun graphique dans le back-office | Graphique « par jour » avec les jours à zéro, répartition par tâche, jauge de plafond, courbes en petit dans les tuiles de chiffres clés |
| Tuile de chiffre clé (KPI) | Non (des `div` dans `couts/page.tsx`) | `StatTile` : étiquette mono, chiffre animé, variation, petite courbe |
| Champs de formulaire d'administration | Non partagés : `apps/web/src/app/admin/_ui/fields.tsx` (`TextField`, `SelectField`, `CheckboxField`, `Notice`, `EmptyState`) | Les déplacer dans `packages/ui`. Aides sous les champs sans casser l'alignement. Champ numérique localisé (virgule), curseur de probabilité, champ prix avec aperçu |
| Champ fichier ou zone de dépôt | Non (un `input type="file"` natif) | `FileDropzone` traduit, avec le nom du fichier et l'aperçu |
| Éditeur de référentiel (arbre unités → notions, glisser-déposer, feuille de notion) | Non (`program-editor.tsx`, `notion-panel.tsx` propres à l'application) | Arbre repliable, cartes de notion, `sheet.tsx` pour la fiche, combobox de prérequis (`command.tsx` et `popover.tsx` existent) |
| Carte de notion avec pastille de validation | `badge.tsx` | Variantes « Validée » et « À valider » colorées |
| File de validation (notions et exercices) | Non | Liste avec aperçu, verdict `services/math`, actions groupées |
| Matrice de permissions | Non (blocs de `checkbox.tsx` répétés) | Tableau rôles × permissions avec cases et regroupement |
| Interrupteur avec libellé et confirmation | `switch.tsx`, `dialog.tsx` | Modèle `ConfirmSwitch` pour les actions sensibles (contrat, retrait de rôle) |
| Panneau de détail du journal (clé–valeur) | Non (`<details>` et JSON brut) | `KeyValueList` traduit dans `sheet.tsx` |
| Liste ordonnée de modèles d'IA | Non (champ texte séparé par des virgules) | Puces déplaçables avec validation |
| Filtres en puces (pays) | Non (des liens stylés dans `collectif/page.tsx`) | `toggle-group.tsx` existe : en faire un `FilterChips` |
| État vide illustré | `EmptyState` local (cadre pointillé et texte) | Version avec `GlowTile` et icône animée, explication et action |
| Pastille d'icône colorée et icônes animées | Non : seulement dans `apps/site/src/wa/ui/components/ui/glow-tile.tsx` et `apps/site/src/wa/ui/icons/*` | Les déplacer dans `packages/ui` |
| Fil d'Ariane | `breadcrumb.tsx` (déjà utilisé dans le référentiel) | Restyler en mono avec des séparateurs fins |
