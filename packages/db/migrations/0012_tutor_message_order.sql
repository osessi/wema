-- Ordre exact des messages d'une séance : deux messages enregistrés dans la
-- même milliseconde (question de l'élève, réponse du prof IA) gardent leur ordre.
ALTER TABLE tutor_messages ADD COLUMN seq bigserial;
