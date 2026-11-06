# 0020 · Formats adaptés : choisis au service, contrôlés, mesurés

_Novembre 2026, lot 11._

## Contexte

Les préférences de format (schémas, BD, audio…) étaient enregistrées dans le profil, mais rien ne produisait ces formats. Le format doit individualiser la présentation sans jamais changer ce qui est évalué, et le système doit apprendre quel format marche pour chaque élève.

## Décision

1. **Le format est choisi au moment de servir la variante** (`choosePresentation`, `@wema/exercises`), pas à sa création. `planVariant` et `generateVariant` n'en dépendent pas : niveau, étapes, nombres et réponse sont identiques quel que soit le format. L'élève peut toujours changer de format.
2. **Trois sources de poids** : hypothèses du profil (confiance, une hypothèse démentie pénalise) ; adaptation liée à un besoin déclaré et consenti (dyslexie → lecture facile), sans que la raison affichée nomme le besoin ; **mesure** du taux de réussite au premier essai par format, lissée, qui ne compte qu'à partir de 5 réponses dans le format et 5 ailleurs, et pèse pleinement à 20.
3. **Le format présenté entre dans le journal** : champ facultatif `format` de `answer.submitted` (absent des anciens événements). Le profil reste recalculé depuis le journal.
4. **Schémas pilotés par la donnée** : un registre de gabarits de figure associe des _formes de tâche_ (type de tâche et écriture de la formule, paramètres quelconques) à une figure. Aucun test sur la matière ou la notion.
5. **Reformulations par l'IA sous contrôle** : BD (3 à 5 cases) et lecture facile passent par `@wema/ai-gateway`, sont validées par Zod puis par `checkFaithful` : chaque formule recopiée, chaque nombre présent autant de fois, aucun nombre ajouté, aucune trace de la réponse. Un échec garde le texte vérifié. L'IA ne reçoit ni la réponse ni de donnée d'élève (au plus deux centres d'intérêt au libellé sûr).
6. **Cache par variante** (`variant_renderings`) : une reformulation acceptée ou refusée n'est demandée qu'une fois.

## Conséquences

- La mesure est biaisée par le libre choix de l'élève (il peut choisir la BD quand l'exercice lui paraît facile) et par la difficulté des exercices. Une présentation tirée au hasard, à état comparable, la rendrait plus fiable (comme pour les étapes guidées, lot 6).
- Les nombres écrits en lettres ne sont pas contrôlés : la consigne l'interdit, et les nombres en chiffres doivent tous être là.
- Ajouter une figure = ajouter un gabarit (formes + construction) et son dessin côté web.
