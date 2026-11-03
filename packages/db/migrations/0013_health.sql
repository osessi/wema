-- Fiche de décision 0006 : besoins particuliers (données de santé) hors du
-- journal, chiffrés, effaçables, partagés seulement avec l'accord du parent.

CREATE TABLE health_declarations (
  id uuid PRIMARY KEY,
  learner_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Besoin chiffré (AES-256-GCM) ; need_hash (HMAC) sert à l'unicité sans le révéler.
  need_enc text NOT NULL,
  need_hash text NOT NULL,
  active boolean NOT NULL,
  declared_by uuid REFERENCES users (id) ON DELETE SET NULL,
  declared_org uuid NOT NULL REFERENCES organizations (id),
  declared_role text NOT NULL CHECK (declared_role IN ('guardian', 'teacher')),
  consent_status text NOT NULL CHECK (consent_status IN ('pending', 'given')),
  consent_by uuid REFERENCES users (id) ON DELETE SET NULL,
  consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, need_hash)
);

CREATE TABLE health_shares (
  learner_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations (id),
  granted_by uuid REFERENCES users (id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, organization_id)
);
