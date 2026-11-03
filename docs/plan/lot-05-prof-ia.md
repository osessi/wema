# Lot 5 · Prof IA : plan d'implémentation

**Objectif :** le prof IA de chaque matière converse avec l'élève, sans jamais donner la réponse finale : il questionne, donne des indices progressifs, fait expliquer (mode « explique-moi »), vérifie à l'oral, et repère l'idée fausse derrière une réponse fausse. Chaque échange utile laisse une trace dans le journal de l'élève. Un banc d'essai (`evals/`) mesure la qualité des réponses.

**Cadre :** back-end seulement (décision du 1er novembre 2026). Tous les appels à l'IA passent par `@wema/ai-gateway`. Branche `lot-05-prof-ia` (partie du lot 4).

## Règles

- **Jamais la réponse finale** (règle n°1) : quand la réponse attendue est connue (aide sur un exercice, vérification orale), la réponse du prof IA est **contrôlée avant d'être envoyée**. Si elle révèle la réponse, elle est régénérée avec une consigne renforcée, puis remplacée par une relance sûre. Ces réponses-là ne sont pas transmises au fil de l'eau ; les autres (question sur le cours, « explique-moi ») peuvent l'être.
- **Une seule question de relance par tour**, réponses courtes, ton adapté, en français.
- **Aucune donnée personnelle envoyée** : le prof IA parle à « l'élève », jamais à un nom ; il reçoit seulement l'état de l'élève sur la notion (maîtrise, idées fausses actives).
- **Rien n'est figé sur une matière** : la consigne est générique ; chaque matière peut recevoir des consignes propres, réglables par l'équipe Wema.
- **Pas de diagnostic** : le prof IA ne pose aucune étiquette sur l'élève.

## Modes

| Mode                  | Code              | Ce que fait le prof IA                                                    |
| --------------------- | ----------------- | ------------------------------------------------------------------------- |
| Aide sur un exercice  | `exercise_help`   | questionne et guide sur sa variante, sans la résoudre                     |
| Question sur le cours | `course_question` | explique la notion avec des exemples, finit par une question              |
| Explique-moi          | `teach_back`      | joue l'élève naïf ; à la fin, évalue la compréhension                     |
| Vérification orale    | `oral_check`      | « explique comment tu as trouvé » ; à la fin, juge si l'explication tient |

## Tâches

1. **Domaine :** modes, séance et messages ; nouveaux événements `hint.requested`, `teachback.assessed`, `oralcheck.assessed`.
2. **`@wema/tutor` :** consignes par mode, contrôle « révèle la réponse », politique des indices (niveaux 1 à 3), réponse guidée, analyse d'une réponse fausse (quelle idée fausse ?), évaluation de fin de séance (« explique-moi », vérification orale). Tests avec un faux fournisseur.
3. **Base :** séances et messages (ajout seul) ; consignes propres à une matière.
4. **API (espace élève) :** ouvrir une séance, envoyer un message (réponse en flux SSE quand c'est permis), demander un indice, terminer la séance (évaluation ajoutée au journal). Correction d'une réponse : si elle est fausse, l'idée fausse repérée par l'IA (avec un seuil de confiance) entre dans l'événement. API d'administration : consignes par matière.
5. **`evals/` :** scénarios de conversation (élève qui demande la réponse, qui insiste, qui se trompe, « explique-moi »…) et critères automatiques (jamais la réponse, une question par tour, longueur, français, pas de données personnelles). Lancement : `pnpm --filter @wema/api evals` avec la clé OpenRouter ; un critère bloquant en échec fait échouer la commande.

## Hors de ce lot

L'audio (parole de l'élève, voix du prof IA), la bande dessinée et les autres formats, l'entretien initial (lot 6), les relances (lot 7).
