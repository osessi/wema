-- Paiement (fiche de décision 0009) : offres par pays et par matière, abonnements
-- élève × matière, paiements, événements reçus des fournisseurs, organisations
-- sous contrat. Prix, devises et périodes sont des données, jamais du code.

-- Organisation (école, réseau de profs) facturée sur mesure, hors paiement en
-- ligne : ses élèves ont accès à toutes les matières.
ALTER TABLE organizations ADD COLUMN under_contract boolean NOT NULL DEFAULT false;

-- Offre : le prix d'une matière dans un pays.
CREATE TABLE offers (
  id uuid PRIMARY KEY,
  country_id uuid NOT NULL REFERENCES countries (id),
  subject_id uuid NOT NULL REFERENCES subjects (id),
  -- Code ISO 4217 (EUR, XOF, CHF…).
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  -- Montant en plus petite unité de la devise (centimes pour l'euro, franc pour le XOF).
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  -- Durée d'une période payée, en mois.
  interval_months integer NOT NULL DEFAULT 1 CHECK (interval_months BETWEEN 1 AND 12),
  -- Essai gratuit, une fois par élève et par matière (0 : pas d'essai).
  trial_days integer NOT NULL DEFAULT 0 CHECK (trial_days BETWEEN 0 AND 90),
  -- Moyens de paiement proposés pour cette offre.
  methods text[] NOT NULL DEFAULT '{}' CHECK (methods <@ ARRAY['card', 'mobile_money']::text[]),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Une seule offre active par pays et par matière.
CREATE UNIQUE INDEX offers_active_country_subject ON offers (country_id, subject_id) WHERE active;

-- Abonnement d'un élève à une matière.
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY,
  learner_id uuid NOT NULL REFERENCES users (id),
  subject_id uuid NOT NULL REFERENCES subjects (id),
  offer_id uuid NOT NULL REFERENCES offers (id),
  -- Adulte qui a souscrit (parent).
  payer_id uuid REFERENCES users (id) ON DELETE SET NULL,
  -- Fournisseur du dernier paiement ; NULL pendant un essai.
  provider text CHECK (provider IN ('stripe', 'kkiapay', 'dev')),
  -- trialing : essai ; active : payé ; past_due : renouvellement refusé (accès jusqu'à
  -- l'échéance) ; canceled : résilié (accès jusqu'à l'échéance) ; ended : terminé.
  status text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'ended')),
  trial_ends_at timestamptz,
  -- Échéance de la période payée.
  current_period_end timestamptz,
  -- Abonnement récurrent chez le fournisseur (Stripe), sinon NULL.
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

-- Un seul abonnement en cours par élève et par matière.
CREATE UNIQUE INDEX subscriptions_live ON subscriptions (learner_id, subject_id) WHERE status <> 'ended';
CREATE UNIQUE INDEX subscriptions_external ON subscriptions (provider, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX subscriptions_learner_idx ON subscriptions (learner_id);

-- Paiement : le prix est recopié au moment du paiement (une offre modifiée ensuite
-- ne change pas ce qui a été payé).
CREATE TABLE payments (
  id uuid PRIMARY KEY,
  subscription_id uuid REFERENCES subscriptions (id),
  learner_id uuid NOT NULL REFERENCES users (id),
  subject_id uuid NOT NULL REFERENCES subjects (id),
  offer_id uuid NOT NULL REFERENCES offers (id),
  payer_id uuid REFERENCES users (id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('stripe', 'kkiapay', 'dev')),
  method text NOT NULL CHECK (method IN ('card', 'mobile_money')),
  kind text NOT NULL CHECK (kind IN ('initial', 'renewal')),
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL,
  interval_months integer NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
  -- Référence chez le fournisseur (session Stripe, facture Stripe, transaction Kkiapay).
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

-- Une transaction du fournisseur ne paie qu'une fois.
CREATE UNIQUE INDEX payments_external ON payments (provider, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX payments_payer_idx ON payments (payer_id, created_at DESC);

-- Événements (webhooks) déjà traités : un envoi rejoué n'est appliqué qu'une fois.
CREATE TABLE payment_events (
  provider text NOT NULL,
  event_id text NOT NULL,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);
