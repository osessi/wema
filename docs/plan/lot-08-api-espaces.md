# Lot 8 · API des espaces (élève, prof, parent, école) : plan d'implémentation

**Objectif :** dernier lot du back-end avant le front-end. Les écoles et les profs organisent leurs élèves en **classes** rattachées à un programme ; le prof donne des **devoirs datés** (une variante par élève, vérifiée) ; il voit la **carte de sa classe** (qui maîtrise quoi, qui bloque sur quoi, idées fausses fréquentes, devoirs rendus) ; le parent suit ses enfants ; l'école a sa vue d'ensemble ; l'élève voit ses devoirs et le programme de sa classe guide ses prochaines notions.

**Cadre :** back-end seulement. Branche `lot-08-api-espaces` (partie du lot 7).

## Modèle

- **Classe** : groupe d'une organisation (école, réseau de profs), rattaché à un programme du référentiel (classe × matière d'un pays), avec ses profs et ses élèves.
- **Devoir** : un exercice validé donné à une classe avec une échéance ; chaque élève reçoit sa variante (forme selon son profil, vérifiée par `services/math`), reliée au devoir.
- **Lien parent ↔ enfant** : dans une organisation famille, le parent déclare ses enfants (lien explicite, pas déduit des rôles).
- **Permissions** : `classes.manage` (créer des classes, y affecter profs et élèves) ; un prof voit et pilote les classes dont il est prof.

## Tâches

1. **Domaine et base** : classes, membres de classe, devoirs (échéance, auteur), variante reliée à un devoir, liens parent ↔ enfant.
2. **Orchestrateur** : un devoir proche de l'échéance passe en tête ; le programme de la classe propose la **prochaine notion nouvelle** dont les prérequis sont validés ; la relance tient compte d'une échéance proche.
3. **API prof et école** : classes (création, profs, élèves), devoirs (donner, suivre), carte de la classe (par élève et par notion), vue d'ensemble de l'école.
4. **API élève et parent** : devoirs de l'élève (à faire, rendus, en retard) ; enfants du parent, avec leur progression et leurs devoirs.
5. **Tests** de chaque règle et des droits (un prof ne voit que ses classes, un parent que ses enfants).

## Hors de ce lot

La messagerie entre prof, parent et élève, la photo de copie, la facturation, la marque blanche (logo) : à prévoir avec le front-end.
