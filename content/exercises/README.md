# Exercices d'exemple

Exercices modèles de la bibliothèque Wema pour les notions du jeu d'exemple (`content/curriculum/`). Ils sont importés dans l'organisation Wema par `pnpm --filter @wema/api seed`, puis validés par `services/math` s'il est démarré.

Un fichier par pays (`fr.yaml`, `bj.yaml`) : chaque exercice désigne sa notion par son code. Le format suit `ExerciseIntent` (`@wema/domain`) : énoncé avec emplacements, tâche mathématique paramétrée, plages des paramètres par niveau (1 à 3), contraintes SymPy, étapes.
