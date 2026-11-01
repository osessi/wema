-- Lot 2 : organisations, comptes, rôles configurables, référentiel par pays,
-- réglages pédagogiques et journal d'audit (fiches de décision 0003 et 0004).

CREATE FUNCTION forbid_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% est en ajout seul', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Organisations ---------------------------------------------------------------

CREATE TABLE organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('platform', 'school', 'tutoring', 'family')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Une seule organisation de plateforme : Wema.
CREATE UNIQUE INDEX organizations_single_platform ON organizations (kind)
  WHERE kind = 'platform';

-- Comptes ---------------------------------------------------------------------

CREATE TABLE users (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  -- Adulte qui a créé le compte (compte élève géré), sinon NULL.
  created_by uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);

-- Moyens de connexion d'un utilisateur.
CREATE TABLE identities (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  kind text NOT NULL CHECK (kind IN ('email', 'phone', 'google', 'apple', 'username')),
  -- E-mail normalisé, numéro E.164, identifiant Google / Apple, identifiant élève.
  identifier text NOT NULL,
  -- Empreinte du mot de passe (email) ou du code de connexion (username).
  secret_hash text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, identifier)
);

CREATE INDEX identities_user_idx ON identities (user_id);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Codes à usage unique envoyés par SMS ou WhatsApp.
CREATE TABLE one_time_codes (
  id uuid PRIMARY KEY,
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX one_time_codes_phone_idx ON one_time_codes (phone, created_at);

-- Rôles et appartenances ------------------------------------------------------

CREATE TABLE roles (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id),
  name text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name),
  UNIQUE (id, organization_id)
);

CREATE TABLE memberships (
  user_id uuid NOT NULL REFERENCES users (id),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  role_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id, role_id),
  -- Le rôle appartient forcément à l'organisation de l'appartenance.
  FOREIGN KEY (role_id, organization_id) REFERENCES roles (id, organization_id)
);

CREATE INDEX memberships_organization_idx ON memberships (organization_id);

-- Référentiel -----------------------------------------------------------------
-- Rien n'est supprimé : on archive (archived_at), car le journal d'événements
-- peut faire référence aux notions et aux idées fausses.

CREATE TABLE countries (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  unit_label_singular text NOT NULL,
  unit_label_plural text NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subjects (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE grades (
  id uuid PRIMARY KEY,
  country_id uuid NOT NULL REFERENCES countries (id),
  name text NOT NULL,
  position integer NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_id, name),
  UNIQUE (id, country_id)
);

CREATE TABLE programs (
  id uuid PRIMARY KEY,
  country_id uuid NOT NULL,
  grade_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES subjects (id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grade_id, subject_id),
  UNIQUE (id, country_id),
  FOREIGN KEY (grade_id, country_id) REFERENCES grades (id, country_id)
);

CREATE TABLE units (
  id uuid PRIMARY KEY,
  country_id uuid NOT NULL,
  program_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  position integer NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, country_id),
  FOREIGN KEY (program_id, country_id) REFERENCES programs (id, country_id)
);

CREATE TABLE notions (
  id uuid PRIMARY KEY,
  country_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  position integer NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_id, code),
  UNIQUE (id, country_id),
  FOREIGN KEY (unit_id, country_id) REFERENCES units (id, country_id)
);

-- Un prérequis relie deux notions du même pays.
CREATE TABLE notion_prerequisites (
  notion_id uuid NOT NULL,
  prerequisite_id uuid NOT NULL,
  country_id uuid NOT NULL,
  PRIMARY KEY (notion_id, prerequisite_id),
  CHECK (notion_id <> prerequisite_id),
  FOREIGN KEY (notion_id, country_id) REFERENCES notions (id, country_id),
  FOREIGN KEY (prerequisite_id, country_id) REFERENCES notions (id, country_id)
);

CREATE TABLE misconceptions (
  id uuid PRIMARY KEY,
  notion_id uuid NOT NULL REFERENCES notions (id),
  description text NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX misconceptions_notion_idx ON misconceptions (notion_id);

-- Réglages --------------------------------------------------------------------

CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users (id)
);

-- Journal d'audit -------------------------------------------------------------

CREATE TABLE audit_log (
  id uuid PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES users (id),
  organization_id uuid REFERENCES organizations (id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX audit_log_organization_at_idx ON audit_log (organization_id, at DESC);

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();
