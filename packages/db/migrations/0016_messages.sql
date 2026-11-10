-- Lot 10 : messagerie entre profs, élèves et parents.
--
-- Deux sortes de fils :
--   * direct : entre deux personnes qui ont un lien réel (prof ↔ élève d'une
--     de ses classes, prof ↔ parent d'un de ces élèves). Les droits sont
--     revérifiés à chaque envoi : un lien perdu ferme l'écriture.
--   * class : annonces d'un prof à sa classe ; les membres sont ceux de la
--     classe au moment de la lecture, seuls ses profs y écrivent.

CREATE TABLE conversations (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('direct', 'class')),
  -- Fil direct : les deux identifiants triés, pour n'avoir qu'un fil par paire.
  direct_key text UNIQUE,
  class_id uuid UNIQUE REFERENCES classes (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  CHECK ((kind = 'direct') = (direct_key IS NOT NULL)),
  CHECK ((kind = 'class') = (class_id IS NOT NULL))
);

-- Participants des fils directs (exactement deux).
CREATE TABLE conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX conversation_participants_user_idx ON conversation_participants (user_id);

CREATE TABLE messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id uuid REFERENCES users (id) ON DELETE SET NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_conversation_idx ON messages (conversation_id, created_at);

-- Dernière lecture de chaque fil par chaque personne : ce qui est plus récent est non lu.
CREATE TABLE conversation_reads (
  conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);
