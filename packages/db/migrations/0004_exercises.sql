-- Lot 3 : exercices (intentions), variantes par élève, banque hebdomadaire.

-- Une idée fausse ciblée par un exercice appartient à la notion de l'exercice.
ALTER TABLE misconceptions ADD CONSTRAINT misconceptions_id_notion_key UNIQUE (id, notion_id);

CREATE TABLE exercise_intents (
  id uuid PRIMARY KEY,
  -- Organisation propriétaire ; celle de Wema pour la bibliothèque commune.
  organization_id uuid NOT NULL REFERENCES organizations (id),
  notion_id uuid NOT NULL REFERENCES notions (id),
  objective text NOT NULL,
  misconception_id uuid,
  statement text NOT NULL,
  task jsonb NOT NULL,
  parameters jsonb NOT NULL,
  constraints jsonb NOT NULL DEFAULT '[]',
  steps jsonb NOT NULL DEFAULT '[]',
  expected text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'archived')),
  source text NOT NULL CHECK (source IN ('teacher', 'admin', 'ai')),
  created_by uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (misconception_id, notion_id) REFERENCES misconceptions (id, notion_id)
);

CREATE INDEX exercise_intents_notion_idx ON exercise_intents (notion_id, status);
CREATE INDEX exercise_intents_organization_idx ON exercise_intents (organization_id);

-- Variante servie à un élève : vérifiée avant d'être enregistrée, jamais modifiée.
CREATE TABLE exercise_variants (
  id uuid PRIMARY KEY,
  intent_id uuid NOT NULL REFERENCES exercise_intents (id),
  learner_id uuid REFERENCES users (id),
  seed bigint NOT NULL,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 3),
  scaffolded boolean NOT NULL,
  hint_level integer NOT NULL CHECK (hint_level BETWEEN 0 AND 3),
  parameters jsonb NOT NULL,
  statement text NOT NULL,
  rendered jsonb NOT NULL,
  steps jsonb NOT NULL,
  answer jsonb NOT NULL,
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exercise_variants_learner_idx ON exercise_variants (learner_id, created_at DESC);

CREATE TRIGGER exercise_variants_append_only
  BEFORE UPDATE OR DELETE ON exercise_variants
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- Banque hebdomadaire : exercices proposés pour une notion et une semaine,
-- retenus ou écartés par le prof.
CREATE TABLE exercise_bank_entries (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id),
  notion_id uuid NOT NULL REFERENCES notions (id),
  -- Lundi de la semaine concernée.
  week date NOT NULL CHECK (extract(isodow FROM week) = 1),
  intent_id uuid NOT NULL REFERENCES exercise_intents (id),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'selected', 'rejected')),
  proposed_by uuid REFERENCES users (id),
  decided_by uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE (organization_id, week, intent_id)
);

CREATE INDEX exercise_bank_week_idx ON exercise_bank_entries (organization_id, week, notion_id);
