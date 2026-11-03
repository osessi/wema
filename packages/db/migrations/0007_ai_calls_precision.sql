-- Relecture du lot 4 : un appel à un petit modèle peut coûter moins d'un
-- millionième de dollar ; numeric(12,6) l'arrondissait à 0.
ALTER TABLE ai_calls ALTER COLUMN cost_usd TYPE numeric(14, 10);
