export interface Plan {
  readonly id: 'presence' | 'croissance' | 'domination';
  readonly name: string;
  readonly monthly: number;
  readonly firstMonth: number | null;
  readonly recommended: boolean;
  readonly pitch: string;
  readonly videosPerWeek: number;
  readonly googlePostsPerWeek: number;
  readonly extraNetworks: readonly ('youtube' | 'linkedin')[];
  readonly reviews: boolean;
  readonly website: boolean;
  readonly includes: readonly string[];
}

export const plans: readonly Plan[] = [
  {
    id: 'presence',
    name: 'Présence',
    monthly: 249,
    firstMonth: null,
    recommended: false,
    pitch: 'Être visible chaque semaine, sans y penser.',
    videosPerWeek: 1,
    googlePostsPerWeek: 1,
    extraNetworks: [],
    reviews: false,
    website: false,
    includes: [
      '1 vidéo par semaine sur Facebook, Instagram et TikTok',
      '1 publication Google par semaine',
      'Réponses aux commentaires et aux messages',
    ],
  },
  {
    id: 'croissance',
    name: 'Croissance',
    monthly: 399,
    firstMonth: null,
    recommended: true,
    pitch: 'Le bon rythme pour faire venir de nouveaux clients.',
    videosPerWeek: 2,
    googlePostsPerWeek: 2,
    extraNetworks: [],
    reviews: false,
    website: false,
    includes: [
      '2 vidéos par semaine sur Facebook, Instagram et TikTok',
      '2 publications Google par semaine',
      'Réponses aux commentaires et aux messages',
    ],
  },
  {
    id: 'domination',
    name: 'Domination',
    monthly: 900,
    firstMonth: 1000,
    recommended: false,
    pitch: 'Occuper tout le terrain dans votre ville.',
    videosPerWeek: 3,
    googlePostsPerWeek: 2,
    extraNetworks: ['youtube', 'linkedin'],
    reviews: true,
    website: true,
    includes: [
      '3 vidéos par semaine, plus YouTube Shorts et LinkedIn',
      '2 publications Google par semaine',
      'Collecte d’avis clients',
      'Site internet offert',
    ],
  },
];

export const extraChannelMonthly = 49;

export const commitmentMonths = 3;

export function formatEuros(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}
