# Jeu d'exemple du référentiel

Depuis le lot 2, le référentiel est géré dans l'application (back-office) et stocké en base : voir `docs/decisions/0003-referentiel-en-base.md`.

Ce dossier n'est plus la source de vérité. C'est un **jeu d'exemple** importable pour le développement, les tests et les démonstrations (`loadCurriculumSeed` dans `@wema/curriculum`). Les unités et les classes ci-dessous sont des exemples : elles n'ont pas été validées par un enseignant (`verified: false`).

- `subjects.yaml` : matières, communes à tous les pays.
- `<pays>/country.yaml` : code, nom, nom des unités, classes dans l'ordre.
- `<pays>/<fichier>.yaml` : un programme (classe × matière), ses unités et leurs notions. Les prérequis et les idées fausses sont désignés par leur code.
