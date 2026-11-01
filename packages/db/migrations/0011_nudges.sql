-- Lot 7 : relances préparées pour un élève (au plus une par jour).
CREATE TABLE nudges (
  id uuid PRIMARY KEY,
  learner_id uuid NOT NULL REFERENCES users (id),
  day date NOT NULL,
  -- Raison : la prochaine action qui justifie la relance (finish_exercise, spaced_review…).
  reason text NOT NULL,
  notion_id uuid REFERENCES notions (id),
  content text NOT NULL,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'read')),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (learner_id, day)
);

CREATE INDEX nudges_learner_idx ON nudges (learner_id, created_at DESC);
