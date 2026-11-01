-- Lot 8 : classes, devoirs datés, liens parent ↔ enfant.

CREATE TABLE classes (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id),
  name text NOT NULL,
  program_id uuid REFERENCES programs (id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE class_members (
  class_id uuid NOT NULL REFERENCES classes (id),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('learner', 'teacher')),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id)
);

CREATE INDEX class_members_user_idx ON class_members (user_id);

CREATE TABLE assignments (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES classes (id),
  intent_id uuid NOT NULL REFERENCES exercise_intents (id),
  title text NOT NULL,
  due_at timestamptz NOT NULL,
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assignments_class_idx ON assignments (class_id, due_at);

-- Variante donnée dans le cadre d'un devoir (une par élève et par devoir).
ALTER TABLE exercise_variants ADD COLUMN assignment_id uuid REFERENCES assignments (id);
CREATE UNIQUE INDEX exercise_variants_assignment_learner ON exercise_variants (assignment_id, learner_id)
  WHERE assignment_id IS NOT NULL;

-- Lien explicite parent ↔ enfant, dans une organisation famille.
CREATE TABLE guardianships (
  organization_id uuid NOT NULL REFERENCES organizations (id),
  guardian_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, guardian_id, learner_id)
);
