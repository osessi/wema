# Lot 7 · Suivi actif : plan d'implémentation

**Objectif :** pour chaque élève, Wema décide de la **prochaine action** utile et **relance** au bon moment : terminer un exercice commencé, travailler une notion fragile, remonter à un prérequis, cibler une idée fausse, revoir une notion validée (re-test espacé), proposer une victoire facile après plusieurs échecs, faire l'entretien initial. C'est l'orchestrateur de l'architecture (§2.6).

**Cadre :** back-end seulement. Branche `lot-07-suivi-actif` (partie du lot 6).

## Règles pédagogiques (testées)

- **Exercice à terminer** : une variante ouverte (ni réussie, ni à court d'essais) passe en premier.
- **Prérequis d'abord** : si une notion bloque (à travailler, plusieurs réponses) et qu'un de ses prérequis n'est pas validé, on propose le prérequis. C'est remonter à la vraie cause du blocage.
- **Idée fausse active** : une séance ciblée sur l'idée fausse, avant de continuer.
- **Victoire facile** : après 3 échecs d'affilée sur une notion, une variante simple et guidée, et une séance courte.
- **Re-test espacé** : une notion validée est revue après 3, puis 7, 21 et 60 jours (intervalle qui s'allonge à chaque rappel réussi, et repart au début après un échec).
- **Entretien initial** : tant qu'il n'a pas eu lieu, il est proposé (sans bloquer le reste).
- **Relance** : après 2 jours sans activité, s'il y a quelque chose d'utile à faire, un message court et bienveillant est préparé (au plus un par jour et par élève), sans jamais contenir de réponse.

## Tâches

1. **`@wema/orchestrator`** : `nextActions(...)` (fonction pure, actions classées avec leur raison et leur preuve), calendrier des re-tests espacés, choix de la relance. Tests de chaque règle.
2. **Base** : relances (`nudges`) avec leur raison, leur texte, leur état (préparée, lue) ; une seule par élève et par jour.
3. **Relances** : rédigées par l'IA (tâche `nudge.write`, modèle économique), courtes, avec le prénom jamais envoyé (« tu »), centres d'intérêt bienvenus, jamais de réponse ; texte de secours sans IA si elle est indisponible.
4. **Planificateur** : un passage régulier (toutes les heures) prépare les relances dues. Un planificateur interne suffit tant qu'il n'y a qu'un serveur ; pg-boss remplacera ce passage quand il y en aura plusieurs (la base garantit déjà « une seule relance par jour »).
5. **API** : prochaines actions de l'élève, ses relances (lire, marquer comme lue) ; lancement manuel du passage pour l'équipe Wema.

## Hors de ce lot

L'envoi par messagerie (WhatsApp, e-mail, notifications), les devoirs datés donnés par un prof (lot 8), les heures calmes selon le fuseau de l'élève (à prévoir avec les préférences de notification).
