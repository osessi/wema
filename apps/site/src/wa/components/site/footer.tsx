import { contactHref, loginHref, signupHref } from '../../config/site';
import { FooterExtras } from './footer-extras';
import { TicketFooter } from './ticket-footer';

interface FooterLink {
  readonly label: string;
  readonly href: string;
}

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Le produit',
    links: [
      { label: 'Comment ça marche', href: '/#methode' },
      { label: 'Les matières', href: '/#matieres' },
      { label: 'L’offre', href: '/#offre' },
      { label: 'Questions fréquentes', href: '/questions-frequentes' },
    ],
  },
  {
    title: 'Pour qui',
    links: [
      { label: 'Familles', href: '/familles' },
      { label: 'Profs particuliers', href: '/profs-particuliers' },
      { label: 'Écoles et réseaux', href: '/ecoles' },
      { label: 'Essai gratuit', href: signupHref },
    ],
  },
  {
    title: 'Wema',
    links: [
      { label: 'Contact', href: contactHref },
      { label: 'Se connecter', href: loginHref },
      { label: 'Mentions légales', href: '/app/mentions-legales' },
      { label: 'Confidentialité', href: '/app/confidentialite' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="[--tsf-cta-ink:var(--background)]">
      <TicketFooter linkGroups={COLUMNS} company="Wema" extras={<FooterExtras />} />
    </footer>
  );
}
