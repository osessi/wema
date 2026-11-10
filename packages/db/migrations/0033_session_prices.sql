-- Séance supplémentaire payante, réservée par le parent dans l'agenda.
--
-- * session_prices : prix d'une séance avec un prof, fixé par l'équipe Wema
--   pour un pays. Aucun prix par défaut : sans ligne, la réservation reste
--   gratuite et rien ne change.
-- * session_charges : montant dû pour une séance réservée par un parent
--   (recopié au moment de la réservation). Tant qu'il n'est pas payé, la
--   séance ne peut pas être confirmée.
-- * session_payments : tentatives de paiement d'une séance, par le même
--   fournisseur que les abonnements (Stripe, Kkiapay, ou le faux fournisseur
--   de développement).

CREATE TABLE session_prices (
  country_id uuid PRIMARY KEY REFERENCES countries (id),
  -- Code ISO 4217 (EUR, XOF, CHF…).
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  -- Montant en plus petite unité de la devise.
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  methods text[] NOT NULL DEFAULT '{}' CHECK (methods <@ ARRAY['card', 'mobile_money']::text[]),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE session_charges (
  session_id uuid PRIMARY KEY REFERENCES tutoring_sessions (id) ON DELETE CASCADE,
  country_id uuid NOT NULL REFERENCES countries (id),
  currency text NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  methods text[] NOT NULL DEFAULT '{}',
  payer_id uuid REFERENCES users (id) ON DELETE SET NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE session_payments (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES tutoring_sessions (id) ON DELETE CASCADE,
  payer_id uuid REFERENCES users (id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('stripe', 'kkiapay', 'dev')),
  method text NOT NULL CHECK (method IN ('card', 'mobile_money')),
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

-- Une transaction du fournisseur ne paie qu'une fois.
CREATE UNIQUE INDEX session_payments_external ON session_payments (provider, external_id)
  WHERE external_id IS NOT NULL;
CREATE INDEX session_payments_session_idx ON session_payments (session_id);

-- Compteurs du back-office : demandes de contact non traitées, notions à vérifier.
CREATE INDEX contact_requests_unhandled_idx ON contact_requests (created_at) WHERE handled_at IS NULL;
CREATE INDEX notions_unverified_idx ON notions (country_id) WHERE NOT verified AND archived_at IS NULL;
