-- Icône d'une matière, choisie dans le référentiel parmi une liste fermée
-- (`SUBJECT_ICONS` de @wema/domain, dessinée par `SubjectIcon` de @wema/ui).
-- Nulle tant qu'aucune n'est choisie : l'interface montre alors une icône
-- générique. La liste est vérifiée à la frontière de l'API.

ALTER TABLE subjects ADD COLUMN icon text;

-- Données : les matières déjà en base reçoivent l'icône de leur code, pour
-- que la production en ait tout de suite. La correspondance vit ici, pas dans
-- le code de l'application ; l'équipe la change ensuite dans le back-office.
UPDATE subjects SET icon = m.icon
FROM (VALUES
  ('maths', 'math'),
  ('mathematiques', 'math'),
  ('francais', 'french'),
  ('anglais', 'language'),
  ('espagnol', 'language'),
  ('allemand', 'language'),
  ('langues', 'language'),
  ('sciences', 'science'),
  ('svt', 'biology'),
  ('biologie', 'biology'),
  ('physique', 'physics'),
  ('physique-chimie', 'physics'),
  ('pct', 'physics'),
  ('chimie', 'chemistry'),
  ('histoire', 'history'),
  ('histoire-geo', 'history'),
  ('histoire-geographie', 'history'),
  ('geographie', 'geography'),
  ('philosophie', 'philosophy'),
  ('philo', 'philosophy'),
  ('economie', 'economics'),
  ('ses', 'economics'),
  ('informatique', 'computer'),
  ('nsi', 'computer'),
  ('arts', 'art'),
  ('arts-plastiques', 'art'),
  ('musique', 'music'),
  ('eps', 'sport'),
  ('sport', 'sport')
) AS m (code, icon)
WHERE subjects.code = m.code AND subjects.icon IS NULL;
