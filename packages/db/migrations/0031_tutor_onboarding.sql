-- Démarrage du prof particulier (assistant d'étapes et liste sur son accueil).
-- La plupart des étapes se déduisent des données (un groupe, des élèves, un
-- devoir) ; on ne garde ici que les choix du prof : étape passée (ne pas
-- créer de compte parent) ou liste de démarrage masquée.

CREATE TABLE onboarding_steps (
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  step text NOT NULL CHECK (step IN ('welcome', 'parents', 'checklist')),
  status text NOT NULL CHECK (status IN ('done', 'skipped')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id, step)
);
