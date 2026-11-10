-- Tour 3 : jetons de notification push de l'appli mobile (Expo).
--
-- Un jeton désigne un appareil. S'il est enregistré par un autre compte (même
-- téléphone, autre élève), il change de propriétaire : un appareil ne reçoit
-- que les notifications de la personne connectée.

CREATE TABLE push_tokens (
  token text PRIMARY KEY CHECK (length(token) BETWEEN 1 AND 255),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX push_tokens_user_idx ON push_tokens (user_id, last_seen_at DESC);
