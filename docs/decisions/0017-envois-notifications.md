# 0017 · Les envois passent par des adaptateurs HTTP, un journal et les préférences de chacun

- **Date :** 2026-11-03
- **Statut :** proposé (tour 3, à valider par Olivier ; aucun prestataire n'a encore de compte)

## Contexte

Les codes de connexion par téléphone ne s'affichaient que dans la console, les relances du suivi actif étaient préparées sans jamais partir, et la messagerie ne prévenait personne. Le choix du prestataire SMS / WhatsApp reste ouvert (coût par message, couverture), et aucun SDK ne doit être ajouté.

## Décision

- **Adaptateurs HTTP** (`fetch`, sans SDK) derrière deux interfaces, `TextSender` (SMS, WhatsApp) et `EmailSender` : **Twilio** et **Vonage** (SMS et WhatsApp, au choix par canal), **Resend** (e-mail). Activés par les variables d'environnement ; sans elles, la console en développement, un canal indisponible en production. Modèles WhatsApp approuvés facultatifs (code, notification).
- **Emplacement** : `apps/api/src/notify/`, pas un paquet. Ce sont des entrées-sorties de façade (comme la connexion Google / Apple), sans logique pédagogique ; un paquet n'apporterait rien de plus aujourd'hui. À sortir en paquet si une autre façade (mobile, tâches séparées) doit envoyer.
- **Préférences par personne** (`notification_preferences`) : un canal pour les relances et un pour les messages (`app`, `email`, `sms`, `whatsapp`, `off`), des heures calmes et un fuseau horaire IANA. Par défaut : dans l'application seulement, 21 h – 8 h, UTC. Un canal externe n'est accepté que si la personne a l'adresse correspondante (e-mail, téléphone vérifié).
- **Journal des envois** (`notification_deliveries`) : chaque notification y entre, en attente puis envoyée, échouée (code court, jamais le message du prestataire) ou annulée (préférence changée entre-temps). Les codes de connexion n'y sont pas (secrets). Réservation par `FOR UPDATE SKIP LOCKED` : plusieurs serveurs n'envoient pas deux fois ; trois essais au plus pour une erreur passagère.
- **Relances** : à l'élève (son texte de relance) et à chacun de ses parents (texte fixe, bienveillant, sans détail sur l'élève), dans les 24 h qui suivent la relance et tant qu'elle n'est pas lue.
- **Messagerie** : une notification regroupée (le nombre de messages, jamais leur contenu ni leur auteur), après 10 minutes d'attente, au plus une par heure.
- **Désinscription en un clic** : lien signé (HMAC du secret du serveur, environ 40 caractères), qui repasse la sorte concernée dans l'application ; `List-Unsubscribe` et `List-Unsubscribe-Post` pour l'e-mail (RFC 8058).
- **Mineurs** : tout compte d'élève est traité comme mineur : tutoiement, aucun contenu commercial (un texte suspect est remplacé par un texte fixe).

## Conséquences

- Changer de prestataire ne touche qu'un adaptateur et des variables d'environnement.
- Un lien de désinscription ne périme pas ; il ne fait que couper des envois.
- Un clic automatique (antivirus de messagerie) sur le lien peut désinscrire : limite acceptée, la personne peut se réabonner depuis son compte.
