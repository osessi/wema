-- Test de niveau (positionnement), avant le paiement : un court test adaptatif
-- par matière, sur les notions du programme de l'élève et leurs prérequis.
-- Chaque réponse entre aussi au journal (answer.submitted, placement = vrai) :
-- le profil n'est recalculé que depuis le journal. Ces tables gardent le
-- déroulé du test et la réponse attendue, qui ne quitte jamais le serveur.

CREATE TABLE placement_tests (
  id uuid PRIMARY KEY,
  learner_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects (id),
  program_id uuid NOT NULL REFERENCES programs (id),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  -- Notions écartées pendant le test : aucune question n'a pu être préparée.
  skipped_notions uuid[] NOT NULL DEFAULT '{}'
);

-- Un seul test en cours par élève et par matière.
CREATE UNIQUE INDEX placement_tests_open_key
  ON placement_tests (learner_id, subject_id) WHERE completed_at IS NULL;
CREATE INDEX placement_tests_learner_idx
  ON placement_tests (learner_id, subject_id, started_at DESC);

CREATE TABLE placement_items (
  id uuid PRIMARY KEY,
  test_id uuid NOT NULL REFERENCES placement_tests (id) ON DELETE CASCADE,
  position int NOT NULL CHECK (position >= 0),
  notion_id uuid NOT NULL REFERENCES notions (id),
  intent_id uuid NOT NULL REFERENCES exercise_intents (id),
  statement text NOT NULL,
  rendered jsonb NOT NULL,
  answer jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  response text CHECK (response IS NULL OR length(response) <= 200),
  correct boolean,
  -- Événement du journal créé par la réponse (preuve).
  event_id uuid,
  UNIQUE (test_id, position)
);
