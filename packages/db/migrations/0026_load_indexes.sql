-- Index manquants repérés par les tests de charge (docs/tests-charge-2026-11.md).

-- Liens parent ↔ enfant lus par le parent (ses enfants), par la messagerie
-- (contacts, droit d'écrire) et par les envois : la clé primaire commence par
-- l'organisation et ne sert pas ces recherches.
CREATE INDEX IF NOT EXISTS guardianships_guardian_idx ON guardianships (guardian_id);
CREATE INDEX IF NOT EXISTS guardianships_learner_idx ON guardianships (learner_id);

-- Export RGPD et purge d'un compte : essais, messages envoyés et actions
-- tracées d'une personne, sans parcourir toute la table.
CREATE INDEX IF NOT EXISTS exercise_attempts_learner_idx ON exercise_attempts (learner_id, at);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON messages (sender_id);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log (actor_id, at);
