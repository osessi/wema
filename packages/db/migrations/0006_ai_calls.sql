-- Lot 4 : journal des appels aux modèles d'IA (coût, jetons, durée), en ajout seul.
CREATE TABLE ai_calls (
  id uuid PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  task text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  organization_id uuid REFERENCES organizations (id),
  learner_id uuid REFERENCES users (id),
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  -- Coût en dollars annoncé par le fournisseur (NULL s'il ne le donne pas).
  cost_usd numeric(12, 6),
  latency_ms integer NOT NULL,
  status text NOT NULL CHECK (status IN ('ok', 'error')),
  error_kind text
);

CREATE INDEX ai_calls_at_idx ON ai_calls (at DESC);
CREATE INDEX ai_calls_organization_idx ON ai_calls (organization_id, at DESC);

CREATE TRIGGER ai_calls_append_only
  BEFORE UPDATE OR DELETE ON ai_calls
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
