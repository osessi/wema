export const PEOPLE = {
  emma: { id: 'rep-emma-atelier-nova', name: 'Emma', persona: true },
  lucas: { id: 'rep-lucas-atelier-nova', name: 'Lucas', persona: true },
  ines: { id: 'rep-ines-atelier-nova', name: 'Inès', persona: true },
  claire: { id: 'person-claire-dubois', name: 'Claire Dubois', persona: false },
  marc: { id: 'person-marc-leroy', name: 'Marc Leroy', persona: false },
  sophie: { id: 'person-sophie-martin', name: 'Sophie Martin', persona: false },
  julien: { id: 'person-julien-bernard', name: 'Julien Bernard', persona: false },
  amelie: { id: 'person-amelie-roux', name: 'Amélie Roux', persona: false },
  thomas: { id: 'person-thomas-petit', name: 'Thomas Petit', persona: false },
} as const;

export type PersonKey = keyof typeof PEOPLE;

const PHOTOS: Readonly<Record<string, string>> = {
  'Maya Chen': '/people/maya-chen.webp',
  'Tom Becker': '/people/tom-becker.webp',
  'Daniel Okafor': '/people/daniel-okafor.webp',
  'Sofia Marquez': '/people/sofia-marquez.webp',
  'Sofia Romero': '/people/sofia-romero.webp',
  'Ravi Patel': '/people/ravi-patel.webp',
  'Ravi Shah': '/people/ravi-shah.webp',
  'Lina Haddad': '/people/lina-haddad.webp',
  'Leo Dubois': '/people/leo-dubois.webp',
  'Jonas Weber': '/people/jonas-weber.webp',
  'Clara Weiss': '/people/clara-weiss.webp',
  'Aiko Tanaka': '/people/aiko-tanaka.webp',
  'Ana Petrov': '/people/ana-petrov.webp',
  'Inès Morel': '/people/ines-morel.webp',
  'Nora Ashby': '/people/nora-ashby.webp',
};

export function personPhoto(name: string): string | null {
  return PHOTOS[name] ?? null;
}
