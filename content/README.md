# Contenu pédagogique

Ce dossier est la source de vérité du référentiel : notions, prérequis, idées fausses et correspondances par pays. Il est versionné et relu comme du code. Toute modification passe par une pull request ; les tests de `@wema/curriculum` le valident à chaque fois (prérequis existants, pas de cycle, pas de doublon, pays déclarés).

## Organisation

```
content/curriculum/
├── countries.yaml        pays pris en charge
├── subjects.yaml         matières
└── <matière>/            une notion par fichier
    └── <notion>.yaml
```

## Format d'une notion

```yaml
id: maths.equations-1er-degre # identifiant stable : ne jamais le renommer
subject: maths # doit exister dans subjects.yaml
name: Équations du premier degré
description: Résoudre une équation de la forme ax + b = c…
prerequisites: # identifiants d'autres notions
  - maths.calcul-litteral
misconceptions: # idées fausses typiques, id unique dans la notion
  - id: change-de-cote-change-de-signe
    description: Déplace un terme en changeant son signe sans comprendre…
mappings: # une entrée par pays de countries.yaml
  fr: { grade: 4e, chapter: null, verified: false }
  bj: { grade: 3e, chapter: null, verified: false }
```

- **`id` est permanent.** Le journal d'événements des élèves y fait référence : renommer une notion casse leur historique.
- **`verified`** passe à `true` uniquement quand un enseignant du pays a confirmé la classe et le chapitre. `chapter` vaut `null` tant qu'il n'est pas connu.
