-- Relecture du lot 5 : une fin de séance se réserve d'abord (« finishing »),
-- pour qu'une double demande ne produise pas deux évaluations.
ALTER TABLE tutor_sessions DROP CONSTRAINT tutor_sessions_status_check;
ALTER TABLE tutor_sessions ADD CONSTRAINT tutor_sessions_status_check
  CHECK (status IN ('open', 'finishing', 'finished'));
