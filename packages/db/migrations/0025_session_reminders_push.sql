-- Tour 3 : rappels de séance (agenda) par le module d'envoi, et reçus des
-- notifications push (Expo).

-- Nouveau type de notification : le rappel 24 h ou 1 h avant une séance.
ALTER TABLE notification_deliveries DROP CONSTRAINT notification_deliveries_kind_check;
ALTER TABLE notification_deliveries ADD CONSTRAINT notification_deliveries_kind_check
  CHECK (kind IN ('nudge', 'message', 'session_reminder'));

ALTER TABLE notification_deliveries
  -- Séance concernée, et quel rappel (une seule notification par rappel et par personne).
  ADD COLUMN session_id uuid REFERENCES tutoring_sessions (id) ON DELETE CASCADE,
  ADD COLUMN reminder text CHECK (reminder IN ('24h', '1h')),
  -- Page à ouvrir (chemin du web, propre au rôle du destinataire) ; NULL : accueil.
  ADD COLUMN link_path text CHECK (link_path IS NULL OR link_path LIKE '/%'),
  ADD CONSTRAINT notification_deliveries_session_reminder_unique
    UNIQUE (session_id, reminder, user_id),
  ADD CONSTRAINT notification_deliveries_session_check
    CHECK ((kind = 'session_reminder') = (session_id IS NOT NULL AND reminder IS NOT NULL));

-- Tickets Expo d'envois push acceptés, en attente de leur reçu (lu ~15 min
-- plus tard) : un reçu « DeviceNotRegistered » retire le jeton. Effacés une
-- fois lus, et au plus tard après 24 h.
CREATE TABLE push_receipts (
  ticket_id text PRIMARY KEY CHECK (length(ticket_id) BETWEEN 1 AND 255),
  token text NOT NULL REFERENCES push_tokens (token) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX push_receipts_created_idx ON push_receipts (created_at);
