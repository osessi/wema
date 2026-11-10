# Revue totale de l'application Wema : synthèse (10 novembre 2026)

Cette revue a été menée sur la production (https://wema.winneragency.co/app) avec les comptes de démonstration et le super admin, en lecture seule, sur ordinateur (1440 px) et sur mobile (390 px).

Les rapports détaillés :

| Rapport                                                                            | Ce qu'il couvre                                                                                      |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [`2026-11-revue-eleve.md`](2026-11-revue-eleve.md)                                 | espace élève (11 pages)                                                                              |
| [`2026-11-revue-prof.md`](2026-11-revue-prof.md)                                   | espace prof (10 pages)                                                                               |
| [`2026-11-revue-ecole.md`](2026-11-revue-ecole.md)                                 | espace école (6 pages)                                                                               |
| [`2026-11-revue-parent.md`](2026-11-revue-parent.md)                               | espace parent et compte                                                                              |
| [`2026-11-revue-admin.md`](2026-11-revue-admin.md)                                 | back-office (14 pages)                                                                               |
| [`2026-11-composants-et-design-system.md`](2026-11-composants-et-design-system.md) | inventaire des composants, langage visuel, liste des 68 composants, plan par lots, sources vérifiées |

## 1. État technique

- **Ce qui est propre.** Aucune erreur de console. Aucune requête en échec sur les parcours réels. Aucun chargement infini. Aucune clé de traduction affichée dans l'espace élève.
- **Ce qui ne l'est pas.** Il reste des bugs de logique et d'affichage, listés ci-dessous. Aucun ne bloque toute l'application, mais deux bloquent un parcours de l'élève.

## 2. Bugs à corriger avant la refonte visuelle

### Bloquants (parcours cassé)

1. **Élève : une carte de l'accueil ne mène nulle part.** « Entraîne-toi · Fonctions affines » ouvre le prof IA sans notion, avec le bouton « Commencer » grisé. La notion de 3e est proposée alors qu'elle est hors du programme de la classe de 4e.
2. **Élève : un exercice déjà réussi reste modifiable.** Le passage en lecture seule du champ MathLive est appliqué avant son chargement (`components/learner/math.tsx`).

### Gênants

3. **Prof : la page de classe déborde de 256 px** (onglet « Carte de la classe »). Cause : il manque `min-w-0` sur `SidebarInset` (`packages/ui/src/components/ui/sidebar.tsx:311`). La même cause fait déborder la fiche élève et la fiche exercice sur mobile.
4. **Prof : la banque affiche les gabarits bruts `{expression}`** (`bank-board.tsx:350`, `exercise-library.tsx:102`). Il faut afficher l'énoncé d'aperçu, déjà calculé correctement ailleurs.
5. **Les chiffres de progression divergent** entre l'accueil, le profil et « Mon chemin » de l'élève. Exemple : « 2 réponses, 1 juste » alors que les deux exercices sont réussis.
6. **Parent :**
   - « Abonnements » indique « Aucune matière » alors que l'enfant suit les maths sous contrat ;
   - une hypothèse à 35 % de confiance est marquée « Plutôt vraie » ;
   - « Modifier le programme » s'ouvre vide ;
   - « Paiement introuvable » n'a pas de bouton de retour.
7. **Mobile : défilement horizontal** sur `/parent/famille` et `/admin/couts`.
8. **Actions sensibles sans confirmation :**
   - interrupteur de contrat d'une école (admin) ;
   - retrait d'un rôle (admin et école) ;
   - retrait d'un membre d'une classe (école).
9. **Textes bruts non traduits :**
   - journal de l'école : `bank.propose`, `bank.selected`, `bank.rejected`, `organization.contract` ;
   - admin : tâches d'IA (`tutor.reply`), cibles du journal en anglais, détails en JSON, bouton de fichier « Choose File », latence en « 15232 ms ».
10. **Dates de l'agenda dans la langue du navigateur** (`toLocaleDateString(undefined)` dans `calendar.tsx` et `views.tsx`). Le fuseau est affiché « Non choisi (UTC) » dans les notifications, mais « Africa/Porto-Novo » dans l'agenda.
11. **Pages légales visibles par les élèves avec des « [À compléter : …] »** : 10 sur Confidentialité, 13 sur Mentions légales, 4 sur Conditions. **Il faut les informations de la société.**
12. **Fautes de texte :**
    - « 1 réussies » (`guardian.json:70`) ;
    - « Prof de Élève Un » (`messages.json:17`) ;
    - mélange du tutoiement et du vouvoiement dans l'espace élève ;
    - `/compte/conditions` s'affiche même quand les conditions sont déjà acceptées.
13. **Élève, divers :**
    - l'agenda indique « À rendre » sur des devoirs déjà faits ;
    - le clavier MathLive cache le champ et propose des touches hors programme (intégrale, ln, ∀) ;
    - la bande dessinée met plus de 4 s à charger, sans indication claire.

## 3. Fonctions qui manquent (constat, à arbitrer)

- **École :**
  - pas de page de facturation sur contrat (le contrat se règle seulement dans le back-office) ;
  - pas de vrai flux d'invitation (l'ajout crée directement le compte) ;
  - impossible de modifier ou de supprimer un rôle ;
  - journal limité à 200 lignes.
- **Prof :** la bibliothèque d'exercices n'a ni recherche, ni filtre, ni pagination (sur mobile, la liste fait 9 735 px de haut). L'onglet de classe n'est pas gardé dans l'adresse.
- **Admin :**
  - pas d'écran qui regroupe les exercices et notions à valider (13 notions « À valider », éparpillées) ;
  - l'accueil n'affiche aucun chiffre ;
  - les coûts sont dessinés en barres CSS, qui sautent les jours à zéro.
- **Agenda :** pas de glisser-déposer.
- **Élève :** pas d'éléments de jeu (série de jours, points). L'élève 1 ne voit pas de bouton de réservation, et aucun message n'explique pourquoi.

## 4. La refonte visuelle

Constat : l'application est un **gabarit shadcn neutre**, sans lien visible avec le nouveau site. Les points précis :
- cartes blanches, badges noirs ;
- icônes fines sans couleur ;
- aucune animation ;
- environ 40 cartes faites à la main ;
- 4 badges de statut différents ;
- 4 états vides différents ;
- 2 discussions différentes ;
- des icônes Lucide mélangées aux icônes Phosphor.

**Direction proposée** : l'esprit du site, pas sa copie. Elle se décline en six points :
- **Jetons du site** : fond papier `#f8f8f5`, surfaces, bordures, échelles `-soft` et `-text` pour les statuts, ombres et courbes.
- **Typographie** : Geist pour toute l'application, Geist Mono pour les étiquettes. On garde Lexend pour la lecture facile et STIX pour les formules.
- **Arrondis doux** :

  | Éléments          | Rayon  |
  | ----------------- | ------ |
  | puces             | 6 px   |
  | boutons et champs | 8 px   |
  | menus et bulles   | 10 px  |
  | cartes            | 12 px  |
  | dialogues         | 14 px  |
  | badges et avatars | pilule |

  **Le biseau du site est réservé aux temps forts** : carte héro de chaque espace, bouton principal, carte de réussite, prochaine séance.
- **Icônes en couleur** : les pastilles lumineuses `GlowTile` du menu du site et les icônes animées, déplacées de `apps/site/src/wa` vers `packages/ui`, sur une base Phosphor partout.
- **Mouvement** : titres de page animés à l'apparition (`TsfTitle`, qui reste lisible par les lecteurs d'écran), coche et confettis sobres à la réussite, barre active glissante dans le menu. Tout s'arrête si l'utilisateur réduit les animations.
- **Mobile élève** : une barre d'onglets en bas d'écran.

**Composants** : la liste complète (68 lignes) est au §3 du rapport sur les composants. Pour chacun, elle indique s'il faut le restyler, l'ajouter avec sa commande `npx shadcn add …`, ou le reprendre du site. Les sources ont été vérifiées le 10/11/2026 :

| Source          | Ce qu'on lui prend                                                                |
| --------------- | --------------------------------------------------------------------------------- |
| shadcn officiel | composants de base                                                                |
| CalendarCN      | agenda avec glisser-déposer                                                       |
| Kibo UI         | mini-calendrier, carte d'activité, téléversement avec recadrage, kanban en option |
| Dice UI         | stepper, téléversement                                                            |
| prompt-kit      | discussion                                                                        |
| Magic UI        | anneau, confettis                                                                 |

**À écarter** : coss ui (l'ancien Origin UI), qui repose sur Base UI et non sur Radix, avec un dépôt sous licence AGPL. Animate UI et React Bits sont utilisables, mais sous MIT avec « Commons Clause » : pas de revente des composants.

**remocn (remocn.dev)** : c'est un registre de composants pour les **vidéos Remotion**, pas pour l'interface. Utile pour de futures vidéos d'explication destinées aux élèves, pas pour les écrans de l'application.

## 5. Plan d'exécution

| Lot | Contenu                                                                                      |
| --- | -------------------------------------------------------------------------------------------- |
| A   | Correction des bugs du §2 (hors pages légales, qui attendent les informations de la société) |
| 0   | Jetons                                                                                       |
| 1   | Coquille : barre latérale, en-tête, changement d'espace, en-tête de page animé               |
| 2   | Composants de base                                                                           |
| 3   | Élève                                                                                        |
| 4   | Prof                                                                                         |
| 5   | Parent                                                                                       |
| 6   | École                                                                                        |
| 7   | Admin et compte                                                                              |

À chaque lot :
- **Ne changer aucun libellé ni aucun rôle.** Les tests e2e reposent sur 69 `getByRole`, 26 `getByLabel` et 14 `getByText`.
- Vérifier les thèmes clair et sombre, en captures.
- Faire passer `pnpm typecheck`, `pnpm lint`, `pnpm test`, puis la suite e2e.

## 6. Décisions à prendre (Olivier)

1. **Couleur du bouton d'action principal** : noir, comme aujourd'hui dans l'application, ou jaune, comme sur le site.
2. **Police** : Geist dans toute l'application, comme sur le site, ou garder Urbanist pour les titres.
3. **Tutoiement dans tout l'espace élève**, comme le fait déjà le prof IA : à confirmer.
4. **Éléments de jeu pour l'élève** (série de jours, points, badges) : oui ou non.
5. **Pages légales** : raison sociale, adresse, numéro d'immatriculation, directeur de la publication, hébergeur, contact pour les données personnelles.
6. **Fonctions manquantes du §3** : lesquelles faire maintenant.
