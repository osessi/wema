# 0024 · Agenda, séances en visio et groupes de révision

## Contexte

Le prof (enseignant, prof particulier, mentor) doit pouvoir voir ses élèves en visio, seul à seul ou en petit groupe, et les familles doivent pouvoir réserver un créneau sans échange de messages. Les personnes sont dans des fuseaux différents ; aucun prestataire de visio n'est encore choisi.

## Décision

- **Disponibilités récurrentes stockées comme des règles** (jours, heures locales, fuseau IANA du prof, bornes, une semaine sur N, durée des créneaux), développées à la lecture. Une règle suit les changements d'heure de son fuseau ; une séance est un instant UTC, que chacun voit dans le fuseau de son appareil.
- **Une séance occupe le créneau dès la demande** (`requested`, `proposed`, `confirmed`) ; les conflits du prof et des élèves sont vérifiés dans une transaction, avec un verrou consultatif par personne.
- **Droits = liens de la messagerie** (prof ↔ élève de ses classes actives, parent ↔ prof d'une classe de son enfant). Un élève suivi par un parent passe par lui pour réserver ; un élève sans parent lié réserve lui-même. Une séance de groupe se gère par le prof seul.
- **Visio Jitsi Meet**, domaine réglable (`WEMA_JITSI_DOMAIN`, meet.jit.si par défaut), nom de salle aléatoire de 144 bits, lien donné seulement aux participants d'une séance confirmée. Ouverture dans un onglet par défaut ; intégration en iframe en option. **Aucun enregistrement.**
- **Compte rendu → événement** `session.reported` (source `teacher`) pour chaque élève : le profil n'est jamais écrit directement, et ce compte rendu ne compte pas pour la maîtrise.
- **Rappels 24 h et 1 h** réservés en base (jamais deux fois), remis à une interface d'envoi (`AgendaReminderSender`).

## Conséquences

- meet.jit.si limite l'intégration en iframe (durée, connexion du modérateur) : pour la production, prévoir un Jitsi auto-hébergé ou JaaS, sans changer le code (seul le domaine change).
- Le nom de salle suffit pour entrer : il ne doit circuler que dans l'application (pas de salle d'attente ni de mot de passe pour l'instant).
- Pas encore d'exceptions ponctuelles aux disponibilités (congé d'un jour) : on supprime ou on borne la règle.
