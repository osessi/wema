# services/math

Service de vérification mathématique de Wema (Python, FastAPI, SymPy). Aucune variante d'exercice n'est servie à un élève sans être passée par ici (`AGENTS.md`, règle 2). Le contrat HTTP est décrit dans `docs/plan/lot-03-exercices.md`.

```sh
cd services/math
uv sync
uv run uvicorn wema_math.app:app --port 8000   # lancer le service
uv run pytest -q                               # tests
uv run ruff check && uv run ruff format --check
```

Les entrées (réponses d'élèves, modèles d'exercices) sont filtrées avant d'être analysées : liste blanche de caractères et de fonctions, longueur bornée, taille des nombres bornée.
