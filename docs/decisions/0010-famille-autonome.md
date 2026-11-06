# 0010 · Famille autonome : rôles par défaut, programme individuel, offre du pays du programme

- **Date :** 2026-11-04
- **Statut :** accepté (consigne d'Olivier, tour 4 de recette)

## Contexte

L'offre payante est vendue par matière aux familles (fiche 0009). La recette a montré qu'un parent inscrit seul ne pouvait rien faire : seule l'équipe Wema créait des organisations, une organisation naissait sans rôle, et un enfant hors classe n'avait ni notions ni exercices (le programme de l'élève ne venait que de sa classe). Le pays de l'offre était choisi par le parent, le premier proposé étant le premier par ordre alphabétique.

## Décision

### Rôles par défaut

- Des **modèles de rôles par type d'organisation** sont des données (`DEFAULT_ROLES`, `@wema/domain`), identiques pour tous les pays : famille → « Parent » (gère la famille, lit et déclare pour ses enfants, santé avec consentement) et « Enfant » ; école → « Direction », « Prof », « Élève » ; réseau de profs → « Responsable », « Prof », « Élève ». Aucune permission de plateforme.
- Ils sont créés avec l'organisation, dans la même transaction, quand on le demande (`defaultRoles: true`) : le back-office et le parcours famille le font toujours. Ce sont ensuite des rôles ordinaires, modifiables et supprimables.
- Sans le drapeau, l'API garde l'ancien comportement (organisation sans rôle) : les scripts existants (jeu de démonstration, suites e2e) qui posent leurs propres rôles continuent de fonctionner. À basculer par défaut quand ils seront adaptés.

### Parcours famille (routes `/api/family`)

- Un parent crée **sa** famille (une seule par parent, verrou par utilisateur ; un compte créé pour un élève ne le peut pas) et en devient « Parent ».
- Il ajoute un enfant : prénom, identifiant (code montré une fois) ou e-mail et mot de passe, programme. Le compte, son rôle d'enfant (« Enfant », ou à défaut le rôle le plus modeste qui ne gère pas la famille), le lien parent-enfant, le **consentement parental** (le parent est l'auteur du lien, fiche 0008) et le programme sont créés dans une seule transaction : un programme refusé n'ouvre aucun compte. Limites : 10 enfants par famille, 20 créations par parent et par jour ; un compte existant n'est jamais rattaché.
- Seuls les parents membres de la famille agissent sur ces routes (l'équipe Wema passe par le back-office).

### Programme individuel (migration 0027)

- `learner_programs` : élève × programme du référentiel, choisi dans une famille, un seul programme par matière (clé élève × matière, cohérence garantie par une clé étrangère sur programme × matière), un seul pays par élève.
- Règle du cœur (`effectivePrograms`, `@wema/orchestrator`, testée) : les programmes des classes d'abord ; un programme individuel ne compte que pour une matière qu'aucune classe ne couvre. Le prof de la classe reste maître de sa matière.
- Il sert partout comme celui d'une classe : prochaine notion de l'orchestrateur, chemin de l'élève (`/learner/path`, une entrée par programme), banque de la semaine de la famille (`bankDemands`, `runWeeklyBank`).
- **Exercices personnels** : sans prof, rien ne donnait d'exercice. Le cœur choisit (`choosePersonalPractice`, testé) sur la première action utile un exercice validé de la bibliothèque Wema ou de la famille (idée fausse ciblée d'abord, puis l'exercice le moins souvent reçu) ; la façade en tire une variante adaptée au profil, **vérifiée par services/math**, à la lecture des prochaines actions. Une seule variante ouverte à la fois (verrou par élève), seulement sur une matière ouverte.

### Paiement

- L'offre suit le **pays du programme** de l'enfant : pour une matière qu'il suit, le pays de ce programme ; sinon l'un des pays de ses programmes. Sans programme : refus `program_required` et, côté parent, un renvoi vers le choix du programme. `GET /parent/billing` donne, par enfant, les offres proposables (`offerIds`).

## Conséquences

- Le parcours payant fonctionne sans intervention de l'équipe Wema : inscription → famille → enfant et programme → essai → l'enfant travaille.
- La banque hebdomadaire appelle l'IA aussi pour chaque famille qui a un programme individuel : coût à surveiller (plafonds de la fiche 0021) ; les exercices validés qu'elle produit nourrissent les exercices personnels.
- Une notion sans aucun exercice validé (bibliothèque ou famille) ne reçoit pas d'exercice personnel : l'élève passe à l'action suivante, ou au prof IA.
- `learner_programs` est purgé avec le compte et figure dans l'export RGPD.
