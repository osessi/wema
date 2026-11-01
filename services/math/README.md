# services/math

Service de vérification mathématique de Wema (Python, FastAPI, SymPy). Aucune variante d'exercice n'est servie à un élève sans être passée par ici (`AGENTS.md`, règle 2). Le contrat HTTP de départ est décrit dans `docs/plan/lot-03-exercices.md` ; les compléments ci-dessous font foi.

```sh
cd services/math
uv sync
uv run uvicorn wema_math.app:app --port 8000   # lancer le service
uv run pytest -q                               # tests
uv run ruff check && uv run ruff format --check
```

## Protections

- Les entrées (réponses d'élèves, modèles d'exercices) sont filtrées avant d'être analysées : liste blanche de caractères et de fonctions, longueur bornée, taille des nombres et des développements bornée.
- Chaque calcul SymPy s'exécute dans un processus séparé, tué au-delà d'un délai. Variables d'environnement : `WEMA_MATH_TIMEOUT` (secondes, 3 par défaut), `WEMA_MATH_WORKERS` (calculs simultanés, 4 par défaut), `WEMA_MATH_MEMORY` (octets par calcul, quand le système le permet).
- Aucune erreur 500 : un cas que SymPy ne sait pas traiter donne une raison typée.
- Le service n'a pas d'authentification : il ne doit être joignable que depuis le réseau interne (par l'API).

## Compléments au contrat

### `POST /exercises/check`

- Paramètres : soit `parameters` (un objet), soit `parameterSets` (tableau de 1 à 30 objets), jamais les deux (sinon 422). Les jeux sont essayés dans l'ordre ; le premier qui satisfait les contraintes est résolu.
- Succès : `{ "ok": true, "index": <position du jeu retenu dans parameterSets, 0 avec parameters>, "answer": …, "rendered": … }`.
- Échec : `{ "ok": false, "reason": … }` avec `reason` parmi :
  - `constraint_failed` : aucun jeu ne satisfait les contraintes ;
  - `no_solution` : équation sans solution réelle ;
  - `mismatch` : la réponse annoncée par l'auteur (`expected`) est fausse ;
  - `invalid_input` : écriture refusée (caractère, nom, syntaxe, nom de paramètre réservé) ;
  - `unsupported` : réponse impossible à servir (non réelle, infinie, racine implicite, infinité de solutions) ou cas non traité ;
  - `too_complex` : calcul trop coûteux, ou réponse de plus de 500 caractères.
    Une erreur autre que `constraint_failed` sur un jeu arrête l'essai.
- Noms de paramètres : lettre seule ou minuscules (12 au plus) ; les fonctions autorisées (`sqrt`, `pi`…) et les mots-clés de Python sont refusés. La variable de `solve` est une lettre seule.
- Rendu : pour `evaluate`, l'énoncé n'est jamais calculé (`7 × 8` reste `7 × 8`). Pour les autres tâches, seules des retouches d'écriture sont faites (signe, facteur 1, nombre devant).

### `POST /answers/check`

- Réponse : `{ "correct": bool, "reason": null | "not_equivalent" | "wrong_form" | "invalid_input" | "too_complex" }`.
- `number` : la valeur doit être écrite simplement (`49`, `7,2`, `7/2`, `√52`, `2√13`) ; une opération recopiée (`7^2`, `7×7`, `√(4²+6²)`) donne `wrong_form`. Avec `decimals`, un nombre décimal doit être exactement l'arrondi demandé (plus de décimales : `wrong_form`).
- `factored` : un produit qui compte au moins autant de facteurs non constants que la factorisation attendue ; `1×(…)`, `−(−…)` et `(…)/1` ne comptent pas.
- Écritures tolérées : `X = 5` pour la variable x, point final, espaces insécables, `±`, produits implicites de lettres (`2xy`).

### `POST /steps/check`

Chaque étape est comparée à la précédente étape lisible (même ensemble de solutions ; sans solution réelle, des équations proportionnelles). Une étape trop coûteuse est invalide ; le budget total est de deux fois le délai.
