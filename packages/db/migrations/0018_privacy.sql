-- RGPD (fiche de décision 0008) : purge réglementaire, suppression de compte
-- avec délai de grâce, consentement parental, acceptation des conditions.

-- Purge réglementaire ---------------------------------------------------------
-- Les journaux en ajout seul (learning_events, tutor_messages, exercise_variants,
-- exercise_attempts, ai_calls) refusent toute modification. Seule exception
-- (AGENTS.md, règle 3) : une SUPPRESSION faite par la fonction de purge, qui
-- pose le réglage local à la transaction `wema.regulatory_purge`. UPDATE et
-- TRUNCATE restent interdits dans tous les cas, et le journal d'audit n'est
-- jamais effaçable.

CREATE FUNCTION regulatory_purge_active() RETURNS boolean AS $$
  SELECT coalesce(current_setting('wema.regulatory_purge', true), '') = 'on'
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION learning_events_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND regulatory_purge_active() THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'learning_events est en ajout seul';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME <> 'audit_log' AND regulatory_purge_active() THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% est en ajout seul', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Comptes ---------------------------------------------------------------------

-- Dernière activité (durée de conservation des comptes inactifs) et date de
-- purge : un compte purgé reste une ligne anonyme (« Compte supprimé ») pour
-- que les références (audit, exercices écrits par un prof, coûts d'IA) restent
-- valides sans plus désigner personne.
ALTER TABLE users ADD COLUMN last_seen_at timestamptz;
ALTER TABLE users ADD COLUMN purged_at timestamptz;

CREATE TABLE account_deletions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  -- Qui l'a demandée : la personne elle-même, son parent, ou NULL (inactivité).
  requested_by uuid REFERENCES users (id),
  reason text NOT NULL CHECK (reason IN ('self', 'guardian', 'inactivity')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz NOT NULL,
  cancelled_at timestamptz,
  completed_at timestamptz
);

-- Une seule demande en cours par compte.
CREATE UNIQUE INDEX account_deletions_pending ON account_deletions (user_id)
  WHERE cancelled_at IS NULL AND completed_at IS NULL;
CREATE INDEX account_deletions_due ON account_deletions (scheduled_for)
  WHERE cancelled_at IS NULL AND completed_at IS NULL;

-- Consentement parental -------------------------------------------------------

CREATE TABLE parental_consents (
  id uuid PRIMARY KEY,
  learner_id uuid NOT NULL REFERENCES users (id),
  guardian_id uuid NOT NULL REFERENCES users (id),
  -- Comment il a été recueilli : lien parent-enfant créé par le parent, ou
  -- consentement donné depuis son compte.
  method text NOT NULL CHECK (method IN ('guardian_link', 'account')),
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  given_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);

CREATE INDEX parental_consents_learner_idx ON parental_consents (learner_id);

-- Conditions acceptées --------------------------------------------------------

CREATE TABLE terms_acceptances (
  user_id uuid NOT NULL REFERENCES users (id),
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, terms_version, privacy_version)
);
