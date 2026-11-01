# Lot 4 · Passerelle IA : plan d'implémentation

**Objectif :** une porte unique et sûre vers les modèles d'IA, utilisée par le prof IA (lot 5), l'entretien initial (lot 6) et les relances (lot 7). Aucun autre paquet ne parle à un fournisseur d'IA (règle n°5 d'`AGENTS.md`).

**Décisions d'Olivier (1er novembre 2026) :** deux branchements interchangeables, capables des mêmes choses, **OpenRouter** (en premier) et **Vercel AI SDK** ; back-end seulement.

**Branche :** `lot-04-passerelle-ia` (partie de `lot-03-exercices`). Commits locaux.

## Modèle

- **Tâche IA** (`AiTask`) : catalogue fermé dans `@wema/ai-gateway` (ex. `tutor.reply`, `tutor.hint`, `answer.analyze`, `intake.interview`, `profile.summarize`, `nudge.write`, `exercise.contextualize`), chacune avec un **palier** : `reasoning` (expliquer, corriger) ou `economic` (relances, résumés courts).
- **Routage** (`AiRouting`) : fournisseur actif (`openrouter` ou `ai-sdk`), et pour chaque palier ou tâche la liste ordonnée des modèles (le premier, puis les secours). Stocké dans les réglages (`settings`, clé `ai_routing`), validé, réglable par l'équipe Wema.
- **Appel journalisé** (`AiCall`) : tâche, fournisseur, modèle réellement utilisé, jetons d'entrée et de sortie, coût, durée, statut, organisation et élève concernés. Table en ajout seul.

## Interface (`@wema/ai-gateway`)

- `generateText(request)` → texte.
- `generateObject(request, schema)` → objet validé par un schéma Zod (sortie structurée `json_schema`, puis contrôle Zod).
- `streamText(request)` → fragments de texte au fil de l'eau, puis le résultat complet (jetons, coût).
- Chaque requête porte sa tâche, ses messages et son contexte (organisation, élève), jamais le nom ni les coordonnées de l'élève.

## Garde-fous

- **Données des mineurs :** chez OpenRouter, `provider: { data_collection: "deny", zdr: true }` sur chaque appel ; les e-mails et numéros de téléphone sont masqués dans les messages avant l'envoi ; les appelants n'envoient qu'un pseudonyme.
- **Pannes :** une erreur passagère (429, 502, 503, délai dépassé) est réessayée une fois, puis on passe au modèle de secours ; sinon une erreur typée (`unavailable`, `rate_limited`, `invalid_output`, `refused`, `misconfigured`). Délai maximal par appel.
- **Coût :** chaque appel, réussi ou non, est journalisé avec son coût en dollars (OpenRouter renvoie `usage.cost`).

## Tâches

1. **Paquet `@wema/ai-gateway`** : types, catalogue des tâches, routage par défaut et validation, masquage des données personnelles, passerelle (choix du fournisseur et des modèles, nouvelle tentative, secours, journal).
2. **Branchement OpenRouter** : HTTP direct (`/api/v1/chat/completions`), sorties structurées, flux SSE avec le fragment final d'usage, erreurs typées.
3. **Branchement Vercel AI SDK** : `ai` v7 avec `@openrouter/ai-sdk-provider` (mêmes préférences de confidentialité), mêmes trois fonctions.
4. **Base :** table des appels (ajout seul) et dépôt ; synthèse des coûts par tâche, modèle, organisation et période.
5. **API :** lecture et réglage du routage (permission `ai.manage`, portée plateforme), synthèse des coûts (`ai.manage`), liste des modèles disponibles chez OpenRouter.
6. **Tests :** faux fournisseurs et faux `fetch` (requête envoyée, coût lu, flux, erreurs, secours, masquage) ; un essai réel facultatif avec la clé `OPENROUTER_API_KEY` du fichier `.env` local.

## Hors de ce lot

Les consignes du prof IA et le banc d'essai `evals/` (lot 5), les plafonds de dépense par organisation, l'audio (transcription, synthèse vocale).
