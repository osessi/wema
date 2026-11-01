# 0006 · Les besoins particuliers (données de santé) sont stockés à part, chiffrés et effaçables

- **Date :** 2026-11-01
- **Statut :** accepté (décisions d'Olivier du 1er novembre 2026, après la relecture du lot 6)

## Contexte

Les besoins de type dys ou TDAH sont des données de santé de mineurs (RGPD, art. 9). Au lot 6, ils étaient enregistrés comme des événements du journal d'apprentissage : en clair, lisibles par toute organisation de l'élève ayant le droit « santé », et impossibles à effacer (journal en ajout seul). La relecture a montré que ce n'était pas acceptable.

## Décision

- **Stockage séparé** : les besoins déclarés ne sont plus des événements du journal. Ils vivent dans une table dédiée (`health_declarations`), **chiffrée** au niveau de l'application (AES-256-GCM, clé `WEMA_HEALTH_KEY`, obligatoire en production), et **effaçable** : retirer son consentement supprime la déclaration.
- **Qui déclare** : un parent ou un prof (permission `learners.health.write`). **Le consentement du parent est toujours exigé et enregistré** (qui, quand) : une déclaration de parent est consentie d'emblée ; une déclaration de prof reste **en attente** tant qu'un parent de l'élève ne l'a pas confirmée. Une déclaration en attente n'a aucun effet et n'est visible que de l'organisation qui l'a faite.
- **Qui lit** : l'organisation qui a fait la déclaration, et les organisations avec lesquelles **le parent a choisi de la partager** (`health_shares`), pour leurs membres qui ont `learners.health.read`.
- **Équipe Wema** : elle peut lire ces données pour l'assistance ; **chaque lecture est tracée** dans le journal d'audit (sans le contenu).
- **Prof IA** : il reçoit seulement les adaptations des besoins actifs et consentis, jamais le besoin lui-même ; l'IA ne repère ni ne nomme jamais un trouble (les libellés libres sont filtrés).

## Conséquences

- Le journal d'apprentissage reste en ajout seul sans contenir de donnée de santé.
- La clé de chiffrement doit être gérée comme un secret de production ; sa perte rend les déclarations illisibles.
- Une organisation qui n'a pas reçu le partage ignore l'existence même d'un besoin.
