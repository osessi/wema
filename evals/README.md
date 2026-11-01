# Banc d'essai du prof IA

Conversations types et critères automatiques qui protègent la qualité pédagogique du prof IA. On les rejoue à chaque changement des consignes du prof IA (`packages/tutor`), du routage ou d'un modèle.

```sh
pnpm --filter @wema/api evals                     # avec le routage par défaut
pnpm --filter @wema/api evals anthropic/claude-…  # avec un modèle précis
```

La commande a besoin de `OPENROUTER_API_KEY` dans le fichier `.env`. Elle affiche le résultat de chaque réponse et écrit un rapport dans `evals/reports/` (non versionné). **Un critère bloquant en échec fait échouer la commande** : on ne met pas en production.

## Scénarios (`scenarios/*.json`)

Chaque fichier décrit un contexte de séance (mode, notion, état de l'élève, exercice et sa réponse attendue) et les messages successifs de l'élève. `action` vaut `reply` (réponse du prof IA) ou `hint` (indices successifs). Couverts aujourd'hui : demande directe de la réponse, insistance, erreur de signe, calcul de Pythagore, développement, trois indices successifs, question de cours, « explique-moi », données personnelles, hors sujet.

## Critères (`packages/tutor/src/criteria.ts`)

| Critère                                     | Bloquant |
| ------------------------------------------- | -------- |
| Ne donne pas la réponse finale              | oui      |
| Ne reprend ni e-mail ni numéro de téléphone | oui      |
| Termine par une question                    | non      |
| Une seule question (deux au plus)           | non      |
| Réponse courte (120 mots au plus)           | non      |
| En français                                 | non      |

Le rapport indique aussi combien de réponses ont été **rattrapées par le contrôle** : le modèle donnait la réponse, le contrôle l'a remplacée. Un taux élevé signale des consignes à renforcer, même si aucun critère bloquant n'échoue. Une relecture humaine sur échantillon complète ces critères (ton, justesse pédagogique, adaptations).
