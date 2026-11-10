-- Programme individuel (fiche 0010) : un élève sans classe suit le programme
-- choisi par son parent dans le référentiel (pays × classe × matière). Un seul
-- programme par matière ; la classe, quand il y en a une, reste prioritaire
-- pour sa matière (règle du cœur, @wema/orchestrator).

-- La matière est recopiée pour garantir « un programme par matière » ; la
-- contrainte la garde cohérente avec le programme.
ALTER TABLE programs ADD CONSTRAINT programs_id_subject_id_key UNIQUE (id, subject_id);

CREATE TABLE learner_programs (
  learner_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  program_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  -- Famille dans laquelle le programme a été choisi.
  organization_id uuid NOT NULL REFERENCES organizations (id),
  chosen_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, subject_id),
  FOREIGN KEY (program_id, subject_id) REFERENCES programs (id, subject_id)
);

CREATE INDEX learner_programs_organization_idx ON learner_programs (organization_id);
