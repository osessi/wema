# Glossaire

Le produit, l'interface et la documentation sont en français. Le code (identifiants, noms de fichiers) est en anglais. Ce tableau fait la correspondance : utilisez toujours ces noms-là.

| Terme produit                                | Nom dans le code       | Définition                                                            |
| -------------------------------------------- | ---------------------- | --------------------------------------------------------------------- |
| Élève                                        | `Learner`              | personne suivie, quel que soit son âge                                |
| Prof / coach                                 | `Teacher` (rôle)       | enseignant, prof particulier, coach ou équipe de suivi Wema           |
| Parent                                       | `Guardian`             | responsable légal d'un élève mineur                                   |
| Matière                                      | `Subject`              | maths, physique-chimie…                                               |
| Notion                                       | `Notion`               | unité du programme (ex. théorème de Pythagore)                        |
| Prérequis                                    | `Prerequisite`         | lien orienté entre deux notions                                       |
| Idée fausse                                  | `Misconception`        | erreur de raisonnement typique d'une notion                           |
| Pays                                         | `Country`              | pays dont on suit le programme ; porte le nom de ses unités           |
| Classe (niveau)                              | `Grade`                | niveau scolaire dans un pays (ex. 3e, Seconde)                        |
| Classe (groupe d'élèves)                     | `SchoolClass`          | groupe d'une école ou d'un réseau de profs, rattaché à un programme   |
| Lien parent ↔ enfant                         | `Guardianship`         | lien explicite entre un parent et son enfant, dans une famille        |
| Programme                                    | `Program`              | contenu d'une matière pour une classe d'un pays                       |
| Unité (situation d'apprentissage, chapitre…) | `Unit`                 | regroupement de notions dans un programme                             |
| Organisation                                 | `Organization`         | école, réseau de profs, famille, ou Wema (plateforme)                 |
| Utilisateur                                  | `User`                 | personne qui se connecte, quel que soit son rôle                      |
| Identité de connexion                        | `Identity`             | e-mail, téléphone, Google, Apple ou identifiant élève                 |
| Rôle                                         | `Role`                 | ensemble de permissions, configurable, propre à une organisation      |
| Permission                                   | `Permission`           | action que le code sait vérifier (catalogue fermé)                    |
| Appartenance                                 | `Membership`           | lien utilisateur × organisation × rôle                                |
| Réglages pédagogiques                        | `LearnerModelSettings` | seuils et paramètres du calcul de maîtrise                            |
| Journal d'audit                              | `AuditEntry`           | trace d'une action d'administration                                   |
| Profil de l'élève / jumeau pédagogique       | `LearnerModel`         | état calculé de l'élève à partir des événements                       |
| Hypothèse                                    | `Hypothesis`           | affirmation du profil, avec source, confiance et preuves              |
| Maîtrise                                     | `Mastery`              | probabilité que l'élève maîtrise une notion                           |
| Intention d'exercice                         | `ExerciseIntent`       | ce que l'exercice évalue, indépendamment de la forme                  |
| Variante                                     | `ExerciseVariant`      | rendu d'une intention adapté à un élève                               |
| Banque hebdomadaire                          | `WeeklyBank`           | exercices proposés par l'IA pour une notion et une semaine            |
| Devoir                                       | `Assignment`           | exercice donné à une classe avec une échéance, une variante par élève |
| Événement d'apprentissage                    | `LearningEvent`        | fait daté du journal, ajouté sans jamais être modifié                 |
| Entretien initial                            | `Intake`               | conversation qui produit le premier profil                            |
| Mode « explique-moi »                        | `TeachBack`            | l'élève enseigne, l'IA joue l'élève naïf                              |
| Vérification orale                           | `OralCheck`            | l'élève explique sa démarche à l'oral                                 |
| Relance                                      | `Nudge`                | message de suivi proactif                                             |
| Re-test espacé                               | `SpacedReview`         | question de rappel sur une notion déjà validée                        |
| Source d'un événement                        | `EventSource`          | canal d'où vient l'événement : app, web, messagerie, papier, prof     |

## Statuts d'une notion (`NotionStatus`)

| Statut affiché | Valeur dans le code |
| -------------- | ------------------- |
| Non vue        | `not_seen`          |
| À travailler   | `needs_work`        |
| En cours       | `in_progress`       |
| Validé         | `mastered`          |
