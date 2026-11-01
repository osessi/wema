-- Organisation qui a créé un compte (compte élève géré). Elle seule peut en
-- régénérer le code de connexion (relecture du lot 2).
ALTER TABLE users ADD COLUMN owner_organization_id uuid REFERENCES organizations (id);
