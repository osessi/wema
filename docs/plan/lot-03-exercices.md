# Lot 3 · Exercices et vérification des maths : plan d'implémentation

**Objectif :** un exercice (déposé par un prof, par l'équipe Wema, plus tard proposé par l'IA) se décline en une variante par élève. Ce qui est évalué reste le même ; la forme change (taille des nombres, découpage en étapes, niveau d'indices). Chaque variante est vérifiée par `services/math` avant d'être servie. La réponse de l'élève est corrigée par le calcul et ajoutée à son journal, ce qui recalcule sa maîtrise : c'est la première boucle complète du cœur.

**Cadre (décisions d'Olivier du 1er novembre 2026) :** on termine tout le back-end avant le front-end (shadcn/ui). Ce lot ne livre que de la logique, une base et des routes d'API testées. Pas d'IA dans ce lot : la rédaction et la mise en contexte par l'IA viendront avec la passerelle (lot 4) et le prof IA (lot 5).

**Branche :** `lot-03-exercices` (partie de `lot-02-socle-application`). Commits locaux ; poussée quand Olivier le demande.

## Contraintes

- Règles de `AGENTS.md`, en particulier la règle 2 : **aucune variante n'est servie sans vérification par `services/math`**. Une variante non vérifiée n'est pas enregistrée.
- Le calcul n'est jamais confié à un modèle d'IA, ni fait « à la main » en TypeScript : TypeScript choisit des paramètres, Python (SymPy) calcule et vérifie.
- Les réponses des élèves sont des entrées non fiables : `services/math` n'évalue jamais une chaîne sans l'avoir filtrée (liste blanche de caractères et de fonctions, longueur bornée).
- Toute règle pédagogique (choix du niveau, du découpage, des indices) a ses tests unitaires.
- Aucune matière en dur : un exercice porte une **tâche** générique (résoudre, développer, évaluer…), pas un `if (subject === "maths")`.

## Modèle

- **Intention d'exercice** (`ExerciseIntent`) : notion, organisation propriétaire (l'organisation Wema pour la bibliothèque commune), objectif, idée fausse ciblée (facultative), énoncé modèle avec des emplacements (`{a}`, `{equation}`), **tâche** mathématique paramétrée, paramètres et leurs plages par niveau, contraintes sur les paramètres, étapes de résolution (modèles), statut (`draft`, `validated`, `archived`), auteur et source (`teacher`, `admin`, `ai`).
- **Variante** (`ExerciseVariant`) : intention, élève, graine, niveau (1 à 3), découpage en étapes oui/non, niveau d'indices, valeurs des paramètres, énoncé rendu, réponse canonique, date de vérification. Une variante enregistrée ne se modifie plus.
- **Banque hebdomadaire** : pour une organisation, une notion et une semaine, des intentions proposées, puis retenues ou écartées par le prof.
- **Réponse d'un élève** : un événement `answer.submitted` ajouté au journal, avec la variante en référence et la réponse saisie.

## Contrat de `services/math` (HTTP, JSON)

Expressions au format SymPy (`2*x + 3`, `sqrt(a**2 + b**2)`), égalités avec `=`. Les noms de paramètres sont des lettres seules ou des noms en minuscules sans chiffre ni tiret bas.

### `POST /exercises/check`
Entrée :
```json
{
  "task": { "kind": "solve", "equation": "a*x + b = c", "variable": "x" },
  "parameters": { "a": 3, "b": 2, "c": 11 },
  "constraints": ["Ne(a, 0)", "Eq(Mod(c - b, a), 0)"],
  "expected": null
}
```
Tâches : `solve` (`equation`, `variable`), `expand` (`expression`), `factor` (`expression`), `evaluate` (`expression`, `round` facultatif : nombre de décimales attendues).
Sortie réussie : `{ "ok": true, "answer": <CanonicalAnswer>, "rendered": { "<champ>": { "text": "3x + 2 = 11", "latex": "3 x + 2 = 11" } } }`. `rendered` contient chaque champ mathématique de la tâche (`equation`, `expression`), paramètres remplacés.
Échec : `{ "ok": false, "reason": "constraint_failed" | "no_solution" | "mismatch" | "invalid_input" | "unsupported" }`. `mismatch` : `expected` (expression facultative fournie par l'auteur) ne correspond pas à la réponse calculée.

`CanonicalAnswer` :
- `{ "kind": "solutions", "variable": "x", "values": ["3"] }` (ensemble de solutions, chaque valeur en chaîne SymPy) ;
- `{ "kind": "expression", "value": "3*x + 6", "form": "expanded" | "factored" | "any" }` ;
- `{ "kind": "number", "value": "sqrt(52)", "decimals": 1 | null }` (avec `decimals`, une valeur décimale arrondie à ce nombre de décimales est acceptée).

### `POST /answers/check`
Entrée : `{ "expected": <CanonicalAnswer>, "answer": "x = 3" }`.
Sortie : `{ "correct": true }` ou `{ "correct": false, "reason": "not_equivalent" | "wrong_form" | "invalid_input" }`.
L'élève peut écrire : `3`, `x = 3`, `x=3 ou x=-3`, `3; -3`, virgule décimale, `×`, `÷`, `−`, `²`, `√`. Longueur maximale : 200 caractères.

### `POST /steps/check`
Entrée : `{ "steps": ["2*x + 3 = 11", "2*x = 8", "x = 4"], "variable": "x" }` (équations : même ensemble de solutions d'une étape à l'autre ; expressions : équivalentes).
Sortie : `{ "valid": [true, true, true], "firstInvalid": null }`.

### `GET /health` → `{ "ok": true }`

## Tâches

1. **`services/math`** : FastAPI + SymPy, analyse sûre des entrées, les trois routes, tests pytest et ruff, CI Python.
2. **Domaine** : `ExerciseIntent`, `ExerciseVariant`, tâche, paramètres, `CanonicalAnswer` ; événement `answer.submitted` enrichi de la réponse saisie ; permissions `exercises.read` et `exercises.write` (portée organisation).
3. **`@wema/exercises`** :
   - `planVariant(intent, notionState)` : niveau, découpage, indices selon la maîtrise et les idées fausses actives de l'élève (règle pédagogique testée) ;
   - choix des paramètres par graine dans les plages du niveau ;
   - `MathVerifier` (interface) et son client HTTP ; `generateVariant` qui essaie plusieurs graines et ne renvoie qu'une variante vérifiée ;
   - rendu de l'énoncé et des étapes.
4. **Base** : migration des intentions, variantes (ajout seul), banque hebdomadaire ; dépôts.
5. **API** : bibliothèque et exercices d'organisation (lecture, création, modification, validation par échantillon vérifié, aperçu) ; banque hebdomadaire ; génération des variantes pour des élèves membres (profil recalculé avec les réglages pédagogiques en base) ; côté élève, ses variantes (sans la réponse) et la correction de sa réponse, ajoutée au journal.
6. **Exemples** : exercices modèles pour les notions du jeu d'exemple (France et Bénin).
7. **Vérification** : test de bout en bout avec le vrai `services/math` ; mise à jour de `docs/HANDOFF.md` et de l'architecture.

## Hors de ce lot

Rédaction et mise en contexte par l'IA (centres d'intérêt, bande dessinée, audio), photo de copie, devoirs datés et relances (lot 7), formats autres que le texte.
