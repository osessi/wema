# 0001 · Socle technique

- **Date :** 2026-10-31
- **Statut :** accepté

## Contexte

Wema doit tourner sur le web et sur mobile, brancher plusieurs modèles d'IA et vérifier des mathématiques de façon fiable. L'équipe est petite.

## Décision

- Un monorepo pnpm et Turborepo, en **TypeScript partout** (Next.js, Expo, Node.js).
- **Python** uniquement pour `services/math` : vérification avec SymPy et, plus tard, ajustement des paramètres du modèle de l'élève sur les données. Le calcul de maîtrise (BKT) reste en TypeScript dans `@wema/learner-model` : il est simple, pur et appelé à chaque projection.
- Une seule base **Postgres**. Elle porte aussi la file de tâches (pg-boss).
- Pas de Rust.

## Conséquences

- Le code et les types sont partagés entre web, mobile et serveur.
- La frontière TypeScript/Python doit rester étroite et contractuelle : quelques appels bien typés.
- On ajoutera un autre langage ou un autre service seulement si une mesure le justifie.
