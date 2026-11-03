-- Lot 6 : l'entretien initial est une séance du prof IA sans notion.
ALTER TABLE tutor_sessions ALTER COLUMN notion_id DROP NOT NULL;
ALTER TABLE tutor_sessions DROP CONSTRAINT tutor_sessions_mode_check;
ALTER TABLE tutor_sessions ADD CONSTRAINT tutor_sessions_mode_check
  CHECK (mode IN ('exercise_help', 'course_question', 'teach_back', 'oral_check', 'intake'));
ALTER TABLE tutor_sessions ADD CONSTRAINT tutor_sessions_notion_required
  CHECK (mode = 'intake' OR notion_id IS NOT NULL);
