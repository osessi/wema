# 0005 · La vérification mathématique est un service Python séparé

- **Date :** 2026-11-01
- **Statut :** accepté

## Contexte

La règle n°2 d'`AGENTS.md` impose que toute variante d'exercice mathématique soit vérifiée avant d'être servie, sans jamais faire confiance au calcul d'un modèle d'IA. Il faut aussi corriger les réponses des élèves, écrites de mille façons (`x=3`, `2(x+1)`, virgule décimale, arrondi). SymPy fait cela de façon fiable ; aucune bibliothèque TypeScript ne s'en approche.

## Décision

- `services/math` est un petit service **FastAPI + SymPy** (Python 3.12, géré par uv). Le contrat HTTP est décrit dans `docs/plan/lot-03-exercices.md` et `services/math/README.md` : contrôle d'un exercice paramétré (avec un lot de jeux de paramètres candidats en un seul appel), correction d'une réponse, contrôle d'étapes.
- **TypeScript choisit, Python calcule.** `@wema/exercises` tire les paramètres et choisit la forme de la variante ; il ne fait aucun calcul mathématique lui-même.
- Les entrées (réponses d'élèves, modèles d'exercices) sont **non fiables** : analyse filtrée par liste blanche, taille de l'arbre et des nombres bornée, calculs exécutés dans des processus séparés arrêtés au-delà d'un délai (`too_complex`).
- Une variante non vérifiée n'est jamais enregistrée ; un exercice n'est proposé aux élèves qu'après une variante vérifiée à chaque niveau, pour la version exacte de son contenu.
- Le service n'a pas d'authentification : il n'est joignable que depuis le réseau interne (l'API).

## Conséquences

- Deux langages à maintenir, mais une seule responsabilité côté Python.
- L'API dépend de `services/math` pour préparer des variantes et corriger : s'il est indisponible, elle répond `math_unavailable` sans rien inventer.
- La CI installe Python (uv) et lance un test de bout en bout avec le vrai service.
