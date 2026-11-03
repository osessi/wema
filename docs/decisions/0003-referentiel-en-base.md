# 0003 · Le référentiel est géré dans l'application, pays par pays

- **Date :** 2026-11-01
- **Statut :** accepté (remplace la partie « source de vérité en fichiers » de l'architecture §2.2)

## Contexte

Au lot 1, le référentiel était lu depuis des fichiers YAML relus comme du code (`content/curriculum/`). Olivier veut que le référentiel soit construit **dans l'application**, par le super admin et les rôles qu'il autorise, sans passer par un développeur. Les 4 notions de maths n'étaient qu'un exemple.

Il a aussi tranché :
- les **notions sont propres à chaque pays** : pas d'identifiant commun partagé entre pays ;
- le découpage du programme est choisi **pour chaque pays** : « situation d'apprentissage », « chapitre », « module »…

## Décision

- Hiérarchie : **pays → classe → programme (classe × matière) → unité → notion**, avec les **idées fausses** et les **prérequis** rattachés aux notions.
- **Les matières sont communes à tous les pays** (une matière = un prof IA). Les classes, les programmes, les unités et les notions appartiennent à un pays.
- Le pays porte le **nom de ses unités**, au singulier et au pluriel. Aucun type d'unité n'est écrit en dur.
- Une notion a un **code** lisible, unique dans son pays (ex. `pythagore`), en plus de son identifiant technique.
- Un prérequis relie deux notions **du même pays** et ne doit jamais créer de cycle. La validation est une fonction pure de `@wema/curriculum`, appelée avant chaque écriture.
- Le référentiel est stocké dans Postgres. Rien n'est supprimé physiquement : une notion, une idée fausse ou une unité est **archivée**, car le journal d'événements peut y faire référence.
- Toute modification est tracée dans le **journal d'audit** (qui, quoi, quand).
- Les fichiers de `content/curriculum/` deviennent un **jeu d'exemple** importable (développement, tests, démonstration), et non plus la source de vérité.

## Conséquences

- Le super admin peut créer un pays, ses classes et son programme sans développeur.
- La relecture « comme du code » disparaît : elle est remplacée par le journal d'audit et le drapeau `verified` (validé par un enseignant du pays).
- Un élève qui change de pays change de référentiel : son historique reste, mais ses notions ne se correspondent pas automatiquement. Un lien de correspondance pourra être ajouté plus tard si l'usage le demande.
- Le profil de l'élève et les exercices référencent des identifiants de notions stables, qui ne changent pas quand on renomme une notion.
