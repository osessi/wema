'use client';

import type { ReactNode } from 'react';
import { signupHref } from '../../config/site';
import { useDark } from '../../lib/use-dark';
import TicketStubFooter, { type StubLink, type StubLinkGroup } from '../reactbits/TicketStubFooter';

const SECTIONS: StubLink[] = [
  { label: 'Accueil', href: '/#top' },
  { label: 'Matières', href: '/#matieres' },
  { label: 'Méthode', href: '/#methode' },
  { label: 'Offre', href: '/#offre' },
  { label: 'Questions', href: '/#faq' },
];

const LEGAL: StubLink[] = [
  { label: 'Tous droits réservés' },
  { label: 'Mentions légales', href: '/app/mentions-legales' },
  { label: 'Confidentialité', href: '/app/confidentialite' },
  { label: 'Conditions', href: '/app/conditions' },
  { label: 'Cookies', href: '/app/cookies' },
];

export function TicketFooter({
  linkGroups,
  company,
  extras,
}: {
  readonly linkGroups: StubLinkGroup[];
  readonly company: string;
  readonly extras: ReactNode;
}) {
  const dark = useDark();
  return (
    <TicketStubFooter
      key={dark ? 'dark' : 'light'}
      brand="Wema"
      wordmark="Wema"
      company={company}
      year={new Date().getFullYear()}
      eyebrow={[
        'Un prof IA par matière',
        'Il explique, il ne fait pas à la place',
        'Le programme officiel de chaque pays',
      ]}
      headline={['Il explique.', 'Votre enfant progresse.']}
      description="Wema donne à chaque élève un prof particulier IA par matière. Il apprend à le connaître, adapte chaque exercice et montre ses progrès aux parents et aux profs, preuves à l’appui."
      cta={{ label: 'Commencer l’essai gratuit', href: signupHref }}
      sections={SECTIONS}
      linkGroups={linkGroups}
      statusLabels={['Disponible', 'Disponible']}
      statusCaption="Le prof IA"
      count={24}
      countLabel="Heures sur 24"
      rate={0}
      blurb="L’essai est gratuit et ne demande aucun moyen de paiement. Le premier entretien avec le prof IA est offert, matière par matière."
      legal={LEGAL}
      sideExtra={extras}
      background="transparent"
      ink={dark ? '#F5F6F0' : '#171714'}
      muted={dark ? '#9DA095' : '#74746D'}
      accent="#FFC529"
      accentDeep="#B88700"
      accentInk="#1A1403"
      fontSans="var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
      fontMono="var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace"
    />
  );
}
