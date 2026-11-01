-- Lot 5 : séances avec le prof IA et leurs messages (ajout seul), consignes
-- propres à chaque matière.

ALTER TABLE subjects ADD COLUMN tutor_instructions text NOT NULL DEFAULT '';

CREATE TABLE tutor_sessions (
  id uuid PRIMARY KEY,
  learner_id uuid NOT NULL REFERENCES users (id),
  notion_id uuid NOT NULL REFERENCES notions (id),
  variant_id uuid REFERENCES exercise_variants (id),
  mode text NOT NULL CHECK (mode IN ('exercise_help', 'course_question', 'teach_back', 'oral_check')),
  hint_level integer NOT NULL DEFAULT 0 CHECK (hint_level BETWEEN 0 AND 3),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'finished')),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX tutor_sessions_learner_idx ON tutor_sessions (learner_id, created_at DESC);

CREATE TABLE tutor_messages (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES tutor_sessions (id),
  role text NOT NULL CHECK (role IN ('learner', 'tutor')),
  content text NOT NULL,
  -- Vrai si la première réponse du prof IA révélait la solution et a été remplacée.
  guarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tutor_messages_session_idx ON tutor_messages (session_id, created_at);

CREATE TRIGGER tutor_messages_append_only
  BEFORE UPDATE OR DELETE ON tutor_messages
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
