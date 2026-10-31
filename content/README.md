# Contenu pédagogique

Ce dossier est la source de vérité du référentiel : les notions, leurs prérequis, leurs idées fausses, les correspondances par pays et les exercices modèles. Il est versionné et relu comme du code. Une modification passe par une pull request.

Le format exact sera fixé au premier lot. À titre indicatif, une notion ressemblera à ceci :

```yaml
id: maths.equations-1er-degre
subject: maths
name: Équations du premier degré
prerequisites:
  - maths.calcul-litteral
misconceptions:
  - id: change-de-cote-change-de-signe
    description: « Un nombre qui change de côté change de signe », appliqué sans comprendre l'opération faite des deux côtés.
mappings:
  fr: { grade: 3e, chapter: 3 }
  bj: { grade: 3e, chapter: 2 }
```
