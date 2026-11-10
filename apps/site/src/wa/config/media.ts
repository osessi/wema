export interface Film {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  /** null : la vidéo n'est pas encore tournée, l'emplacement est réservé. */
  readonly src: string | null;
  readonly poster: string | null;
  readonly duration: number;
}

/** La présentation de Wema, sous l'accroche. À déposer dans public/videos/. */
export const vsl: Film = {
  id: 'presentation',
  label: 'Présentation',
  title: 'Wema en une minute',
  src: '/videos/wema-presentation.mp4',
  poster: '/videos/wema-presentation.jpg',
  duration: 60,
};
