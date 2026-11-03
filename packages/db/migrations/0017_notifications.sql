-- Tour 3 : envois (relances et messagerie) par l'application, l'e-mail,
-- WhatsApp ou le SMS, selon les préférences de chacun.

-- Préférences de notification d'un utilisateur. Sans ligne : valeurs par défaut
-- (tout dans l'application, heures calmes de 21 h à 8 h, fuseau UTC).
CREATE TABLE notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  -- Fuseau horaire IANA (« Africa/Porto-Novo », « Europe/Paris »…) ; NULL : UTC.
  time_zone text,
  -- Heures calmes, en heure locale : aucun envoi hors application de
  -- quiet_start (inclus) à quiet_end (exclu). Égales : pas d'heures calmes.
  quiet_start smallint NOT NULL DEFAULT 21 CHECK (quiet_start BETWEEN 0 AND 23),
  quiet_end smallint NOT NULL DEFAULT 8 CHECK (quiet_end BETWEEN 0 AND 23),
  -- Relances (les siennes pour un élève, celles de ses enfants pour un parent).
  nudge_channel text NOT NULL DEFAULT 'app'
    CHECK (nudge_channel IN ('app', 'email', 'sms', 'whatsapp', 'off')),
  -- Nouveaux messages de la messagerie (regroupés).
  message_channel text NOT NULL DEFAULT 'app'
    CHECK (message_channel IN ('app', 'email', 'sms', 'whatsapp', 'off')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Journal des envois : une ligne par notification à une personne, en attente
-- (heures calmes, nouvel essai) puis envoyée, échouée ou annulée. Les codes de
-- connexion n'y sont pas (secrets).
CREATE TABLE notification_deliveries (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('nudge', 'message')),
  channel text NOT NULL CHECK (channel IN ('app', 'email', 'sms', 'whatsapp')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  -- Relance concernée (une seule notification par relance et par personne).
  nudge_id uuid REFERENCES nudges (id) ON DELETE CASCADE,
  -- Messagerie : nombre de messages regroupés, et date du plus récent.
  message_count integer,
  covers_until timestamptz,
  subject text,
  body text NOT NULL,
  provider text,
  provider_ref text,
  attempts integer NOT NULL DEFAULT 0,
  -- Code d'erreur court (jamais le message brut du prestataire).
  last_error text,
  -- Pas d'envoi avant cette date (heures calmes, nouvel essai, envoi en cours).
  not_before timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (nudge_id, user_id),
  CHECK ((kind = 'nudge') = (nudge_id IS NOT NULL))
);

CREATE INDEX notification_deliveries_due_idx
  ON notification_deliveries (not_before) WHERE status = 'pending';
CREATE INDEX notification_deliveries_user_idx
  ON notification_deliveries (user_id, kind, created_at DESC);
