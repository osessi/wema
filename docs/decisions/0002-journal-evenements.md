# 0002 · Le profil de l'élève est calculé à partir d'un journal d'événements

- **Date :** 2026-10-31
- **Statut :** accepté

## Contexte

Le profil de l'élève doit s'améliorer avec le temps, et chaque décision doit pouvoir être expliquée. Il faut aussi pouvoir changer d'algorithme sans perdre l'historique.

## Décision

- Toute interaction pédagogique est enregistrée comme un `LearningEvent`, ajouté au journal et jamais modifié.
- Le `LearnerModel` est une projection de ce journal. Il ne s'écrit jamais directement.
- Chaque hypothèse du profil garde la trace des événements qui la justifient.

## Conséquences

- On peut recalculer tous les profils après un changement d'algorithme.
- Le profil explicable est possible : chaque affirmation pointe vers ses preuves.
- Le journal devient la matière première pour apprendre ce qui marche.
- Le journal contient des données de mineurs : il faut des règles de conservation et d'anonymisation dès le départ.
