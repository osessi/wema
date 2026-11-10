-- Demandes de contact du site public (formulaire /contact), lues par l'équipe
-- Wema dans le back-office (permission contacts.manage).
--
-- L'adresse IP n'est jamais gardée en clair : seulement une empreinte HMAC
-- (clé secrète du serveur), qui sert à repérer des envois en rafale.

CREATE TABLE contact_requests (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 320),
  profile text NOT NULL CHECK (profile IN ('parent', 'eleve', 'prof', 'ecole', 'autre')),
  organization text CHECK (organization IS NULL OR length(organization) <= 200),
  message text NOT NULL CHECK (length(message) BETWEEN 10 AND 4000),
  ip_hash text NOT NULL,
  handled_at timestamptz
);

CREATE INDEX contact_requests_created_idx ON contact_requests (created_at DESC, id DESC);
