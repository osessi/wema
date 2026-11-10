# 0025 · Rappels de séance et notifications push

## Contexte

L'agenda (fiche 0024) prépare des rappels 24 h et 1 h avant chaque séance confirmée, mais rien ne les envoyait. L'appli mobile enregistre ses jetons push (migration 0023) sans que le module d'envoi (fiche 0017) s'en serve.

## Décision

- **Type `session_reminder`** au journal `notification_deliveries` (migration 0025, colonnes `session_id`, `reminder`, `link_path`, unicité par séance, rappel et personne). Préparé dans la tâche « envois » des 5 minutes, avant l'envoi des notifications dues.
- **Pas de nouvelle préférence** : les rappels suivent le canal choisi pour les messages (`message_channel`), affiché comme « Messages et rappels de séance ». C'est le réglage que voient tous les rôles (prof, élève, parent) ; la désinscription d'un rappel coupe donc aussi les messages hors de l'application. Une préférence séparée pourra venir si l'usage le demande.
- **Heures calmes** : le rappel 24 h les respecte (il part à leur fin) ; le rappel 1 h passe outre, sinon une séance du matin serait rappelée après son début. La personne a elle-même accepté une séance à cette heure-là.
- **Revérification à l'envoi** : séance annulée ou commencée, ou rappel 24 h repoussé à moins d'une heure du début : notification annulée.
- **Push** : le canal « app » envoie aussi un push Expo (API HTTP, sans SDK ni compte ; `EXPO_ACCESS_TOKEN` facultatif) à chaque appareil de la personne, hors heures calmes. `DeviceNotRegistered` (ticket ou reçu, reçus lus après 15 min, table `push_receipts`) retire le jeton. Un échec définitif du push laisse la notification « envoyée » : elle reste visible dans l'application.

## Conséquences

- Les relances « dans l'application » passent maintenant par la file d'envoi (statut « en attente » pendant les heures calmes, le temps du push).
- Les messages regroupés sont aussi notifiés à qui garde le canal « application » s'il a un appareil enregistré.
- Le texte des rappels est à l'heure du fuseau de chaque destinataire (UTC s'il n'en a pas choisi, indiqué dans le texte).
