-- Lot 11 : formats adaptés (bande dessinée, lecture facile).
--
-- Mise en cache, par variante, des reformulations produites par l'IA. Une
-- reformulation n'est gardée qu'après contrôle (mêmes formules, mêmes nombres,
-- pas de réponse) ; un refus est gardé aussi (status = 'rejected') pour ne pas
-- repayer un appel qui retomberait sur le texte. Ce n'est pas le profil : le
-- format présenté à chaque réponse est dans le journal (answer.submitted.format).

CREATE TABLE variant_renderings (
  variant_id uuid NOT NULL REFERENCES exercise_variants (id) ON DELETE CASCADE,
  format text NOT NULL CHECK (format IN ('comics', 'easy_reading')),
  status text NOT NULL CHECK (status IN ('ok', 'rejected')),
  content jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (variant_id, format),
  CHECK ((status = 'ok') = (content IS NOT NULL))
);
