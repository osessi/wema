# 0021 · Apprentissage collectif anonymisé et plafonds de dépense de l'IA

_3 novembre 2026_

## Contexte

Le journal d'événements doit servir à apprendre ce qui marche « sur l'ensemble des élèves de façon anonymisée » (architecture §3), sans jamais exposer un élève. Par ailleurs, chaque appel à l'IA coûte : il faut voir la dépense (pour fixer le prix par matière) et pouvoir la borner sans priver un élève de son prof IA.

## Décision

1. **Agrégats dérivés, recalculés en entier** : table `collective_insights` (une ligne par notion), remplacée à chaque calcul (tâche nocturne et bouton du back-office). Le SQL produit des effectifs bruts ; une règle pure (`buildCollectiveInsights`) applique le seuil et classe.
2. **k-anonymat, k ≥ 10, non réglable vers le bas** : une notion, une idée fausse, un format ou un exercice n'est publié que s'il concerne au moins 10 élèves distincts ; sinon il disparaît. Aucun identifiant d'élève ni d'organisation n'est stocké. Seuls les exercices de la bibliothèque commune de Wema sont nommés (ceux d'une organisation restent les siens).
3. **Mesure de progression** : réussite de la réponse suivante du même élève sur la même notion, comparée à la moyenne de la notion. C'est une corrélation, pas une preuve causale ; elle sert d'indice, pas de règle absolue.
4. **Branchement dans le cœur** : `planVariant` reçoit l'avantage collectif des étapes guidées ; à partir de 15 points, un élève « en cours » est guidé. Un candidat à la validation ne l'est jamais.
5. **Plafonds mensuels** (`ai_spending_caps`, mois civil UTC, au centime) : un global et un par organisation, avec un seuil d'alerte (`ai_spending_alerts`, une alerte par portée, mois et niveau). Au-delà, la passerelle refuse les tâches non essentielles ; la liste des tâches essentielles est fermée dans `@wema/ai-gateway` (une nouvelle tâche est non essentielle par défaut). Un contrôle en panne laisse passer l'appel.

## Conséquences

- Tant que peu d'élèves utilisent Wema, presque rien n'est publié : c'est voulu.
- Le coût par matière est une estimation (répartition au prorata des événements de la journée) ; un appel sans élève (banque d'exercices) n'est attribué à aucune matière.
- L'alerte est notée en base et dans les logs, pas encore envoyée par e-mail.
