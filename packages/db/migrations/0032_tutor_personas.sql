-- Prénom et avatar du prof IA, choisis par l'élève : pour toutes ses matières
-- (subject_id nul) ou pour une matière. Un réglage d'affichage, pas une
-- hypothèse sur l'élève : il n'entre pas au journal d'apprentissage.
-- Le prénom est validé par l'API (lettres seulement, sans insulte ni santé).

CREATE TABLE tutor_personas (
  learner_id uuid NOT NULL REFERENCES users(id),
  subject_id uuid REFERENCES subjects(id),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 20),
  avatar text NOT NULL CHECK (avatar IN ('sun', 'owl', 'leaf', 'cloud', 'star', 'initial')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Un seul réglage « toutes les matières » et un seul par matière.
CREATE UNIQUE INDEX tutor_personas_learner_all ON tutor_personas (learner_id) WHERE subject_id IS NULL;
CREATE UNIQUE INDEX tutor_personas_learner_subject ON tutor_personas (learner_id, subject_id) WHERE subject_id IS NOT NULL;
