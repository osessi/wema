# Lot 6 · Profil vivant et entretien initial : plan d'implémentation

**Objectif :** le profil de l'élève ne se limite plus à la maîtrise par notion. Il porte des **hypothèses sur sa façon d'apprendre** (formats qui marchent, centres d'intérêt, rythme, confiance, besoins déclarés), chacune avec une **source**, une **confiance** et des **preuves** (règle n°4). L'**entretien initial**, mené par l'IA, et les **déclarations** du parent, du prof ou de l'élève en posent les premières ; la **mesure** les confirme ou les infirme. Le **profil explicable** montre tout cela au parent et au prof, preuves à l'appui.

**Cadre :** back-end seulement. Branche `lot-06-profil-entretien` (partie du lot 5).

## Choix de prudence (à confirmer par Olivier)

- **Besoins de type dys ou TDAH : seulement déclarés**, par un parent ou un prof, avec le consentement explicite du parent. L'IA ne les repère pas et ne pose jamais de diagnostic (règle n°7). Ce sont des données de santé : elles ne sont lisibles qu'avec une permission dédiée (`learners.health.read`), et jamais envoyées à un fournisseur d'IA ; le prof IA reçoit seulement les **adaptations** qui en découlent (ex. « phrases courtes, une consigne à la fois »).

## Modèle

- **Hypothèse** (`Hypothesis`) : clé (ex. `format.scaffolded`, `interest.sport`, `pace.short_sessions`, `confidence.low`), énoncé lisible, source (`declared_guardian`, `declared_teacher`, `declared_learner`, `intake`, `measured`), confiance de 0 à 1, état (`supported`, `contradicted`, `uncertain`), preuves (identifiants d'événements).
- **Nouveaux événements** : `preference.declared` (une préférence ou un centre d'intérêt déclaré), `need.declared` (un besoin déclaré, donnée de santé, avec le consentement), `intake.completed` (hypothèses tirées de l'entretien). La réponse à un exercice garde désormais sa présentation (guidée par étapes ou non) pour pouvoir mesurer ce qui marche.
- **Projection** : `projectHypotheses(events)` dans `@wema/learner-model`, fonction pure. Une déclaration ouvre une hypothèse avec une confiance modérée ; la mesure (taux de réussite avec et sans étapes guidées, sur assez de réponses) la renforce ou la contredit ; une hypothèse de l'entretien a une confiance faible tant que rien ne la confirme.

## Tâches

1. **Domaine :** hypothèses, catalogue des clés (préférences, besoins), nouveaux événements, présentation dans `answer.submitted`.
2. **`@wema/learner-model` :** `projectHypotheses` et règles de confiance (testées) ; prise en compte des évaluations du prof IA (`teachback.assessed`, `oralcheck.assessed`) comme preuves de compréhension.
3. **Entretien initial :** nouveau mode du prof IA (`intake`) : conversation chaleureuse et courte (centres d'intérêt, façons d'apprendre préférées, confiance, objectifs), puis extraction structurée d'hypothèses (jamais de besoin de santé). Événement `intake.completed`.
4. **API :**
   - déclarations par le parent, le prof ou l'élève (préférences ; besoins avec consentement, permission dédiée) ;
   - entretien initial (séance du prof IA en mode `intake`, puis fin de séance) ;
   - **profil explicable** : maîtrise par notion avec preuves (dernières réponses), idées fausses actives avec les réponses qui les montrent, hypothèses avec source, confiance et preuves ; pour l'élève lui-même, et pour les membres de son organisation qui ont `learners.read` (besoins de santé seulement avec `learners.health.read`).
5. **Le prof IA s'adapte au profil :** formats qui marchent et adaptations issues des besoins déclarés passés dans sa consigne, sans le besoin lui-même.

## Hors de ce lot

Les mini-épreuves sous forme de jeu (lot 8, avec le front-end), l'audio, l'apprentissage collectif anonymisé.
