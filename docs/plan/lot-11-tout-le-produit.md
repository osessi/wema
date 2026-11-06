# Lot 11 · Tout le produit

**Objectif :** coder tout ce qui manquait au produit. Demandé par Olivier le 3 novembre 2026 : « code tout ». Ce lot est sur la branche `lot-09-front-end`.

## Livré

| Chantier                                                                                                                                     | Où regarder                       |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Mise en production : images Docker, Caddy (HTTPS), sauvegardes, pg-boss, durcissement, CI                                                    | `docs/deploiement.md`, fiche 0007 |
| Envois : SMS, WhatsApp (Twilio, Vonage), e-mail (Resend), push (Expo) ; relances, messages, rappels de séance, heures calmes, désinscription | fiches 0017 et 0025               |
| RGPD : export, suppression avec délai, conservation, consentement parental, conditions versionnées, pages légales                            | fiche 0008                        |
| Paiement par matière : Stripe et Kkiapay, offres réglées dans le back-office, droits d'accès, contrats des écoles                            | fiche 0009                        |
| Application mobile élève (Expo)                                                                                                              | `docs/mobile.md`                  |
| Formats adaptés : bande dessinée, lecture facile, schéma, audio, manipulables, choix du format appris                                        | fiche 0020                        |
| Apprentissage collectif anonymisé (k ≥ 10), coûts de l'IA et plafonds, import et export du référentiel, programme 4e et 3e plus fourni       | fiche 0021                        |
| Agenda (semaine, mois, année), réservation, visio Jitsi, groupes de révision, comptes rendus                                                 | fiche 0024                        |

## À faire par Olivier

- **Ouvrir les comptes, puis renseigner les variables listées dans `.env.example` et `infra/env.prod.example` :**
  - un hébergeur ;
  - Twilio ou Vonage ;
  - Resend ;
  - Stripe ;
  - Kkiapay ;
  - Expo, Apple et Google Play.
- **Faire valider par un juriste** les pages légales et les durées de conservation, puis compléter les champs de l'éditeur.
- **Faire valider par Charles** le programme d'exemple : tout est en `verified: false`.
- **Trancher :**
  - la dictée par le navigateur (Chrome envoie la voix chez Google) ;
  - les règles de la messagerie ;
  - qui réserve une séance ;
  - un groupe déplacé sans accord des familles ;
  - les rappels de séance, qui suivent le réglage des messages.

## Limites connues

- Les intégrations Stripe, Kkiapay, Twilio, Vonage et Resend sont testées avec des faux, jamais contre un vrai compte. Les champs de l'API Kkiapay sont à vérifier en mode sandbox.
- L'application mobile n'a pas été essayée sur un vrai téléphone.
- Le design final reste à faire.
