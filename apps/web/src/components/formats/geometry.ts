// Calculs de mise en page des figures (purs, testés) : positions et
// graduations. Aucune donnée de l'exercice n'est calculée ici, seulement où
// dessiner ; les longueurs cherchées restent « ? » à l'écran.

export interface Point {
  x: number;
  y: number;
}

/**
 * Triangle rectangle en A : A en bas à gauche, B en haut (premier côté de
 * l'angle droit), C à droite (second côté). Les côtés sont à l'échelle,
 * ramenés dans un cadre de `size` unités.
 */
export function triangleLayout(
  legs: readonly [number | null, number | null],
  hypotenuse: number | null,
  size = 200,
): { a: Point; b: Point; c: Point; scale: number } {
  let [ab, ac] = legs;
  // Une longueur cherchée est déduite pour le dessin seulement (jamais affichée).
  if (ab === null && ac !== null && hypotenuse !== null)
    ab = Math.sqrt(Math.max(hypotenuse ** 2 - ac ** 2, 1));
  if (ac === null && ab !== null && hypotenuse !== null)
    ac = Math.sqrt(Math.max(hypotenuse ** 2 - ab ** 2, 1));
  const vertical = ab ?? 1;
  const horizontal = ac ?? 1;
  const scale = size / Math.max(vertical, horizontal);
  const a = { x: 0, y: vertical * scale };
  return {
    a,
    b: { x: 0, y: 0 },
    c: { x: horizontal * scale, y: vertical * scale },
    scale,
  };
}

/** Carré construit vers l'extérieur sur le segment [p, q] (sens direct). */
export function squareOn(p: Point, q: Point): Point[] {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  // Normale tournée à gauche de p→q.
  return [p, q, { x: q.x + dy, y: q.y - dx }, { x: p.x + dy, y: p.y - dx }];
}

/** Graduations d'une droite graduée qui montre le départ et l'arrivée. */
export function numberLineTicks(
  start: number,
  step: number,
): { min: number; max: number; ticks: number[]; every: number } {
  const end = start + step;
  const span = Math.abs(step) + 2;
  const every = span <= 22 ? 1 : span <= 60 ? 5 : 10;
  const min = Math.floor((Math.min(start, end) - 1) / every) * every;
  const max = Math.ceil((Math.max(start, end) + 1) / every) * every;
  const ticks: number[] = [];
  for (let t = min; t <= max; t += every) ticks.push(t);
  return { min, max, ticks, every };
}
