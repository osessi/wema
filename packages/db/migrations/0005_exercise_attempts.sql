-- Essais d'un élève sur une variante (relecture du lot 3) : seuls les
-- premiers comptent pour le profil, et leur nombre est limité.
CREATE TABLE exercise_attempts (
  id uuid PRIMARY KEY,
  variant_id uuid NOT NULL REFERENCES exercise_variants (id),
  learner_id uuid NOT NULL REFERENCES users (id),
  correct boolean NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exercise_attempts_variant_idx ON exercise_attempts (variant_id, learner_id);

CREATE TRIGGER exercise_attempts_append_only
  BEFORE UPDATE OR DELETE ON exercise_attempts
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- Numéro de version d'une intention : une validation ne vaut que pour le
-- contenu qui a été vérifié (une modification concurrente l'annule).
ALTER TABLE exercise_intents ADD COLUMN version integer NOT NULL DEFAULT 1;
