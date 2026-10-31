# 0001 · Socle technique

- **Date :** 2026-10-31
- **Statut :** accepté

## Contexte

Wema doit tourner sur le web et sur mobile, brancher plusieurs modèles d'IA et vérifier des mathématiques de façon fiable. L'équipe est petite.

## Décision

- Un monorepo pnpm et Turborepo, en **TypeScript partout** (Next.js, Expo, Node.js).
- **Python** uniquement pour `services/math` : vérification avec SymPy et calculs du modèle de l'élève.
- Une seule base **Postgres**. Elle porte aussi la file de tâches (pg-boss).
- Pas de Rust.

## Conséquences

- Le code et les types sont partagés entre web, mobile et serveur.
- La frontière TypeScript/Python doit rester étroite et contractuelle : quelques appels bien typés.
- On ajoutera un autre langage ou un autre service seulement si une mesure le justifie.
