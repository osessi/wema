-- Lot 11 : apprentissage collectif anonymisé et plafonds de dépense de l'IA.

-- Agrégats par notion, calculés sur tous les élèves de toutes les
-- organisations. Aucune donnée personnelle : ni identifiant d'élève, ni
-- d'organisation, seulement des effectifs et des taux, et seulement pour des
-- groupes d'au moins `min_learners` élèves (k-anonymat). Données dérivées du
-- journal : chaque calcul remplace le précédent.
CREATE TABLE collective_insights (
  notion_id uuid PRIMARY KEY REFERENCES notions (id),
  computed_at timestamptz NOT NULL,
  -- Seuil d'anonymat appliqué à ce calcul (au moins 10).
  min_learners integer NOT NULL CHECK (min_learners >= 10),
  learners integer NOT NULL,
  answers integer NOT NULL,
  success_rate double precision NOT NULL,
  -- Part des élèves bloqués : au moins 3 réponses, aucune juste parmi les 3 dernières.
  stuck_rate double precision NOT NULL,
  -- Nombre moyen de réponses avant la première juste.
  avg_answers_to_success double precision,
  -- Durée moyenne d'une séance avec le prof IA sur la notion, en secondes.
  avg_tutor_seconds integer,
  misconceptions jsonb NOT NULL DEFAULT '[]',
  formats jsonb NOT NULL DEFAULT '[]',
  exercises jsonb NOT NULL DEFAULT '[]'
);

-- Plafonds mensuels de dépense de l'IA, en dollars : un global
-- (organization_id NULL) et un par organisation au plus. Au-delà, les appels
-- non essentiels sont bloqués ; une alerte est levée dès `alert_ratio`.
CREATE TABLE ai_spending_caps (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations (id),
  monthly_usd numeric(12, 2) NOT NULL CHECK (monthly_usd >= 0),
  alert_ratio double precision NOT NULL DEFAULT 0.8 CHECK (alert_ratio > 0 AND alert_ratio <= 1),
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ai_spending_caps_scope
  ON ai_spending_caps (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Alertes de dépense : une seule par portée, par mois et par niveau.
CREATE TABLE ai_spending_alerts (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations (id),
  -- Premier jour du mois concerné (UTC).
  month date NOT NULL,
  level text NOT NULL CHECK (level IN ('warning', 'blocked')),
  spent_usd numeric(14, 6) NOT NULL,
  cap_usd numeric(12, 2) NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ai_spending_alerts_once
  ON ai_spending_alerts (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), month, level);
