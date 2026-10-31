-- Journal des événements d'apprentissage : on ajoute, on ne modifie jamais.
CREATE TABLE learning_events (
  id uuid PRIMARY KEY,
  learner_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL
);

CREATE INDEX learning_events_learner_occurred_idx
  ON learning_events (learner_id, occurred_at);

CREATE FUNCTION learning_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'learning_events est en ajout seul';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER learning_events_append_only
  BEFORE UPDATE OR DELETE ON learning_events
  FOR EACH ROW EXECUTE FUNCTION learning_events_append_only();
