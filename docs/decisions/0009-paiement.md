# 0009 · Paiement par matière : offres en données, Stripe et Kkiapay par HTTP, droits d'accès côté API

- **Date :** 2026-11-03
- **Statut :** accepté (consignes d'Olivier du 3 novembre 2026)

## Contexte

Wema vend **un prof IA par matière** : une famille abonne chaque enfant aux seules matières où il a besoin d'aide (jamais « toutes matières »). Le modèle économique n'est pas figé : prix, devises, pays, durée de période et essai gratuit doivent pouvoir changer sans toucher au code (AGENTS.md, règle 6). Les familles paient par carte ou par Mobile Money ; les écoles et réseaux de profs sont facturés sur mesure, hors paiement en ligne. Aucun compte Stripe ni Kkiapay n'existe encore.

## Décision

- **Offres en données** (`offers`, migration 0019) : une offre = un pays × une matière, avec devise ISO 4217, montant en plus petite unité de la devise, période en mois, jours d'essai et moyens de paiement proposés. Une seule offre active par pays et par matière. Réglées par l'équipe Wema dans `/admin/offres` (permission `organizations.manage`), chaque changement est tracé dans le journal d'audit. Le prix est **recopié** sur chaque paiement : modifier une offre ne change pas ce qui a été payé.
- **Abonnement = élève × matière** (`subscriptions`), avec son payeur (le parent), son fournisseur, son statut (`trialing`, `active`, `past_due`, `canceled`, `ended`) et son échéance. Un seul abonnement en cours par élève et par matière. Un essai gratuit par élève et par matière, sans moyen de paiement. Résilier garde l'accès jusqu'à l'échéance payée ; un essai résilié s'arrête tout de suite.
- **Droits d'accès côté API** : le prof IA (hors entretien initial, gratuit), la réponse aux exercices personnalisés, la photo de copie, les prochaines actions et relances d'une matière ne sont ouverts que si l'élève a un essai en cours, une période payée non échue, ou est membre d'une **organisation sous contrat** (école ou réseau de profs : statut posé par l'équipe Wema, toutes matières incluses). Refus : `402 subscription_required`, avec le chemin de la page Abonnements du parent. La règle est une fonction injectée (`AccessPolicy`) : la base en production, « tout ouvert » dans les tests qui ne portent pas sur le paiement.
- **Fournisseurs par leur API HTTP**, sans SDK, derrière une interface (`apps/api/src/billing/`) :
  - **Stripe (carte)** : Checkout en mode abonnement, prix créé à la volée depuis l'offre ; Stripe renouvelle seul et annonce les renouvellements, refus et fins par webhook (signature `Stripe-Signature` vérifiée en temps constant, horodatage de moins de 5 minutes).
  - **Kkiapay (Mobile Money)** : paiement dans le widget Kkiapay ; un paiement couvre une période, renouvelée par le parent (« Prolonger d'une période », à partir de l'échéance en cours). Le serveur ne croit ni le navigateur ni le corps du webhook : il redemande l'état de la transaction à Kkiapay (montant et référence contrôlés) ; une transaction ne paie qu'une fois.
  - **Rejeu** : chaque événement reçu est noté (`payment_events`) dans la même transaction que son effet ; un envoi rejoué est accusé sans être réappliqué.
  - **Développement** : sans clé (et jamais en production), un faux fournisseur simule un paiement réussi, pour tester le parcours de bout en bout.
- **Paquet** : pas de nouveau paquet. Les adaptateurs sont des intégrations de la façade (comme `notify/`), le stockage est dans `@wema/db` (`billing-store.ts`).

## Conséquences

- Changer un prix, ajouter un pays ou une devise, proposer un essai : un réglage dans le back-office.
- Une offre Stripe déjà souscrite garde son prix chez Stripe jusqu'à la résiliation (le prix créé à la volée est figé dans l'abonnement Stripe).
- Une réduction pour plusieurs matières (évoquée au cadrage) n'est pas encore modélisée : elle viendra comme une donnée de plus (règle de remise), pas comme du code.
- Pas encore de factures ni de reçus envoyés par Wema, ni de rappel avant l'échéance d'une période Mobile Money.
- La politique de sécurité du contenu du web doit autoriser le widget Kkiapay (script, cadre et appels vers `*.kkiapay.me`) avant la mise en service du Mobile Money.
