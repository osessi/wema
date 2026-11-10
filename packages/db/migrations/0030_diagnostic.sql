-- Vague 4 : rendez-vous de diagnostic avec un conseiller Wema, après le paiement.
--
-- * Le conseiller (permission « diagnostic.conduct » dans l'organisation
--   plateforme) publie ses disponibilités avec l'agenda existant
--   (availability_rules) ; le parent réserve un créneau de 15 minutes.
-- * La fiche (rubriques et notes) appartient au rendez-vous. Elle ne contient
--   jamais de donnée de santé : les besoins de santé passent par le
--   consentement du parent (health_declarations).
-- * À la publication, le compte rendu entre au journal comme un événement
--   « diagnostic.reported » (source « advisor ») : c'est lui qui alimente le
--   profil, jamais cette table.

CREATE TABLE diagnostic_appointments (
  id uuid PRIMARY KEY,
  advisor_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  booked_by uuid REFERENCES users (id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('booked', 'cancelled', 'done')),
  -- Salle de visio : nom aléatoire non devinable (jamais d'enregistrement).
  room text NOT NULL UNIQUE,
  -- Fiche du conseiller (brouillon tant que le compte rendu n'est pas publié).
  sheet jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Hypothèses proposées au profil : [{ key, label, value, confidence }].
  hypotheses jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Notes de travail : lues par les seuls conseillers.
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 4000),
  report_event_id uuid,
  reported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK ((status = 'done') = (reported_at IS NOT NULL))
);

-- Un seul rendez-vous prévu ou fait par élève (inclus une fois).
CREATE UNIQUE INDEX diagnostic_appointments_one_per_learner
  ON diagnostic_appointments (learner_id) WHERE status <> 'cancelled';
CREATE INDEX diagnostic_appointments_advisor_idx
  ON diagnostic_appointments (advisor_id, starts_at);
