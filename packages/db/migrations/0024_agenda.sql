-- Tour 3 : agenda, séances en visio avec le prof (ou mentor), groupes de révision.
--
-- * availability_rules : disponibilités récurrentes du prof, dans SON fuseau
--   (« le mardi de 17 h à 19 h, heure de Porto-Novo ») ; elles sont développées
--   à la lecture (packages/db/src/agenda-time.ts), jamais stockées une à une.
-- * study_groups : groupe de révision d'un prof, sur une notion, avec des
--   élèves d'une ou plusieurs de ses classes.
-- * tutoring_sessions : séance datée (instants UTC), avec un élève ou un
--   groupe, sa salle de visio, son statut, ses rappels et son compte rendu.
--   Les droits (prof ↔ élève de ses classes, parent ↔ prof de son enfant) sont
--   revérifiés à chaque lecture et à chaque écriture, comme la messagerie.

CREATE TABLE availability_rules (
  id uuid PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Jours ISO : 1 = lundi … 7 = dimanche.
  weekdays smallint[] NOT NULL CHECK (cardinality(weekdays) BETWEEN 1 AND 7),
  -- Minutes depuis minuit, heure locale du fuseau.
  start_minute smallint NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute smallint NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  time_zone text NOT NULL,
  valid_from date NOT NULL,
  valid_until date,
  every_n_weeks smallint NOT NULL DEFAULT 1 CHECK (every_n_weeks BETWEEN 1 AND 8),
  -- Durée des créneaux proposés à la réservation.
  slot_minutes smallint NOT NULL DEFAULT 60 CHECK (slot_minutes BETWEEN 15 AND 240),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_minute > start_minute),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE INDEX availability_rules_teacher_idx ON availability_rules (teacher_id);

CREATE TABLE study_groups (
  id uuid PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  notion_id uuid REFERENCES notions (id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX study_groups_teacher_idx ON study_groups (teacher_id);

-- Élèves du groupe, avec la classe du prof par laquelle passe le lien.
CREATE TABLE study_group_members (
  group_id uuid NOT NULL REFERENCES study_groups (id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes (id),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, learner_id)
);

CREATE INDEX study_group_members_learner_idx ON study_group_members (learner_id);

CREATE TABLE tutoring_sessions (
  id uuid PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('individual', 'group')),
  learner_id uuid REFERENCES users (id) ON DELETE CASCADE,
  group_id uuid REFERENCES study_groups (id) ON DELETE CASCADE,
  title text CHECK (title IS NULL OR length(title) BETWEEN 1 AND 120),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  -- requested : demandée par le parent ou l'élève, en attente du prof ;
  -- proposed : le prof propose un autre horaire, en attente de la famille ;
  -- confirmed : prévue ; declined / cancelled : n'aura pas lieu ;
  -- done : a eu lieu, compte rendu écrit.
  status text NOT NULL CHECK (status IN ('requested', 'proposed', 'confirmed', 'declined', 'cancelled', 'done')),
  requested_by uuid REFERENCES users (id) ON DELETE SET NULL,
  -- Mot de la demande (« revoir les fractions avant le contrôle »).
  request_note text CHECK (request_note IS NULL OR length(request_note) <= 500),
  -- Salle de visio : nom aléatoire non devinable (jamais d'enregistrement).
  room text NOT NULL UNIQUE,
  -- Compte rendu du prof après la séance.
  report_summary text CHECK (report_summary IS NULL OR length(report_summary) BETWEEN 1 AND 1000),
  report_notion_ids uuid[] NOT NULL DEFAULT '{}',
  reported_at timestamptz,
  reminded_24h_at timestamptz,
  reminded_1h_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK ((kind = 'individual') = (learner_id IS NOT NULL)),
  CHECK ((kind = 'group') = (group_id IS NOT NULL))
);

CREATE INDEX tutoring_sessions_teacher_idx ON tutoring_sessions (teacher_id, starts_at);
CREATE INDEX tutoring_sessions_learner_idx ON tutoring_sessions (learner_id, starts_at);
CREATE INDEX tutoring_sessions_group_idx ON tutoring_sessions (group_id, starts_at);
CREATE INDEX tutoring_sessions_reminders_idx ON tutoring_sessions (starts_at)
  WHERE status = 'confirmed';
