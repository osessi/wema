'use client';

import { GlowTile, type GlowTone } from '../../ui/components/ui/glow-tile';
import {
  type AnimatedIconHandle,
  CalendarCheckIcon,
  ChatsCircleIcon,
  ChatTextIcon,
  CursorClickIcon,
  EnvelopeIcon,
  GearIcon,
  HandshakeIcon,
  HouseIcon,
  StrategyIcon,
  TargetIcon,
  UsersThreeIcon,
} from '../../ui/icons';
import { ThemeToggle } from '../../ui/patterns/theme-toggle';
import Link from 'next/link';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { contactHref, demoBookingUrl, loginHref, signupHref } from '../../config/site';
import { newTabProps } from '../../lib/external-link';
import { useDark } from '../../lib/use-dark';
import CardNav, { type CardNavItem } from '../reactbits/CardNav';
import FlowingMenu from '../reactbits/FlowingMenu';
import FocusFrameButton from '../tweenui/focus-frame-button';
import { TsfArrow } from '../v2/tsf/tsf-cta';
import { WemaLogo } from './wema-logo';

type Glyph = typeof GearIcon;

function RowIcon({ tone, icon: Icon }: { readonly tone: GlowTone; readonly icon: Glyph }) {
  const tile = useRef<HTMLSpanElement>(null);
  const gesture = useRef<AnimatedIconHandle>(null);
  useEffect(() => {
    const row = tile.current?.closest('a, button');
    if (!row) return;
    const start = () => gesture.current?.start();
    const stop = () => gesture.current?.stop();
    row.addEventListener('pointerenter', start);
    row.addEventListener('pointerleave', stop);
    row.addEventListener('focus', start);
    row.addEventListener('blur', stop);
    return () => {
      row.removeEventListener('pointerenter', start);
      row.removeEventListener('pointerleave', stop);
      row.removeEventListener('focus', start);
      row.removeEventListener('blur', stop);
    };
  }, []);
  return (
    <GlowTile ref={tile} tone={tone} size={24} style={{ '--gi-glyph': '64%' } as CSSProperties}>
      <Icon ref={gesture} size={15} className="pointer-events-none" />
    </GlowTile>
  );
}

const icon = (tone: GlowTone, glyph: Glyph) => <RowIcon tone={tone} icon={glyph} />;

const FLOW: Readonly<Record<string, string>> = {
  'Le produit': '#5B7CFF',
  'Pour qui': '#E46BFF',
  Démarrer: '#FFC529',
};

function flowingLinks(item: CardNavItem, close: () => void) {
  const links = item.links ?? [];
  return (
    <div className="tk-flow" style={{ height: links.length * 44 }}>
      <FlowingMenu
        items={links.map((link) => ({
          text: link.label,
          ...(link.href ? { link: link.href } : {}),
          marquee: link.preview ?? link.label,
          icon: link.icon,
        }))}
        align="left"
        imageShape="rounded"
        intro={false}
        bgColor="transparent"
        textColor="inherit"
        marqueeBgColor={FLOW[item.label] ?? '#FFC529'}
        marqueeTextColor={item.label === 'Démarrer' ? '#1A1403' : '#ffffff'}
        borderColor="color-mix(in srgb, currentColor 14%, transparent)"
        speed={70}
        onItemClick={() => close()}
        ariaLabel={item.label}
      />
    </div>
  );
}

const CARDS: CardNavItem[] = [
  {
    label: 'Le produit',
    description: 'Un prof IA par matière, qui fait trouver au lieu de donner.',
    links: [
      {
        label: 'Comment ça marche',
        preview: 'Connaître, adapter, corriger, revenir',
        href: '/#methode',
        icon: icon('indigo', GearIcon),
      },
      {
        label: 'Les matières',
        preview: 'Maths d’abord, les autres arrivent',
        href: '/#matieres',
        icon: icon('indigo', TargetIcon),
      },
      {
        label: 'Questions fréquentes',
        preview: 'Prix, essai, données, besoins dys',
        href: '/questions-frequentes',
        icon: icon('indigo', ChatsCircleIcon),
      },
    ],
  },
  {
    label: 'Pour qui',
    description: 'Les élèves, leurs parents et ceux qui leur enseignent.',
    links: [
      {
        label: 'Familles',
        preview: 'Un prof IA là où votre enfant en a besoin',
        href: '/familles',
        icon: icon('orchid', HouseIcon),
      },
      {
        label: 'Profs particuliers',
        preview: 'Vos élèves progressent entre deux séances',
        href: '/profs-et-ecoles',
        icon: icon('orchid', StrategyIcon),
      },
      {
        label: 'Écoles et réseaux',
        preview: 'Un devoir, une version par élève',
        href: '/profs-et-ecoles#ecoles',
        icon: icon('orchid', UsersThreeIcon),
      },
    ],
  },
  {
    label: 'Démarrer',
    description: 'L’essai est gratuit, sans moyen de paiement.',
    bgColor: '#FFC529',
    textColor: '#1A1403',
    links: [
      {
        label: 'Essai gratuit',
        preview: 'Le premier entretien est offert',
        href: signupHref,
        icon: icon('ember', CursorClickIcon),
      },
      {
        label: 'Se connecter',
        preview: 'Élève, parent, prof ou école',
        href: loginHref,
        icon: icon('ember', HandshakeIcon),
      },
    ],
  },
];

function QuickLink({
  tone,
  glyph,
  label,
  hint,
  href,
  external = false,
  onSelect,
  focusable,
}: {
  readonly tone: GlowTone;
  readonly glyph: Glyph;
  readonly label: string;
  readonly hint: string;
  readonly href?: string;
  readonly external?: boolean;
  readonly onSelect: () => void;
  readonly focusable: boolean;
}) {
  const body = (
    <>
      <RowIcon tone={tone} icon={glyph} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[14px] font-medium tracking-[-0.01em]">{label}</span>
        <span className="truncate font-mono text-[10.5px] tracking-[0.06em] text-[var(--cn-muted)]">
          {hint}
        </span>
      </span>
      <span className="nav-quick-arrow ml-auto size-3.5 shrink-0" aria-hidden="true">
        <TsfArrow />
      </span>
    </>
  );
  const className =
    'nav-quick group/quick flex h-full w-full min-w-0 items-center gap-3 px-4 py-3 text-left text-[var(--cn-text)] outline-none transition-colors hover:bg-foreground/[0.035] focus-visible:bg-foreground/[0.035] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--cn-ring)]';
  const tabIndex = focusable ? undefined : -1;
  if (href === undefined) {
    return (
      <button type="button" className={className} tabIndex={tabIndex} onClick={onSelect}>
        {body}
      </button>
    );
  }
  if (external || newTabProps(href).target !== undefined) {
    return (
      <a
        href={href}
        className={className}
        tabIndex={tabIndex}
        onClick={onSelect}
        {...newTabProps(href)}
      >
        {body}
      </a>
    );
  }
  return (
    <Link href={href} className={className} tabIndex={tabIndex} onClick={onSelect}>
      {body}
    </Link>
  );
}

function quickRow(close: () => void, open: boolean) {
  return (
    <ul
      className={`nav-quick-row grid list-none grid-cols-1 p-0 ${demoBookingUrl === null ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}
    >
      <li className="nav-quick-cell">
        <QuickLink
          tone="ember"
          glyph={EnvelopeIcon}
          label="Essai gratuit"
          hint="Sans moyen de paiement"
          href={signupHref}
          onSelect={close}
          focusable={open}
        />
      </li>
      <li className="nav-quick-cell">
        <QuickLink
          tone="crimson"
          glyph={ChatTextIcon}
          label="Contact"
          hint="Écrire à l’équipe"
          href={contactHref}
          onSelect={close}
          focusable={open}
        />
      </li>
      {demoBookingUrl === null ? null : (
        <li className="nav-quick-cell">
          <QuickLink
            tone="indigo"
            glyph={CalendarCheckIcon}
            label="Prendre rendez-vous"
            hint="Choisissez un créneau"
            href={demoBookingUrl}
            external
            onSelect={close}
            focusable={open}
          />
        </li>
      )}
    </ul>
  );
}

const TOKENS = {
  '--cn-logo': '36px',
  '--cn-bar': '68px',
  '--cn-panel': 'color-mix(in srgb, var(--background) 86%, transparent)',
  '--cn-edge': 'var(--tk-edge)',
  '--cn-highlight': 'transparent',
  '--cn-shadow': 'none',
  '--cn-text': 'var(--foreground)',
  '--cn-muted': 'var(--muted-foreground)',
  '--cn-hover': 'transparent',
  '--cn-tile': 'transparent',
  '--cn-tile-rim': 'inset 0 0 0 1px var(--tk-line)',
  '--cn-cta-hover': 'none',
} as CSSProperties;

export function SiteNav() {
  const dark = useDark();
  const theme = dark ? 'dark' : 'light';
  const [footerInView, setFooterInView] = useState(false);
  useEffect(() => {
    const footer = document.querySelector('footer');
    if (footer === null) return;
    const watch = new IntersectionObserver(([entry]) =>
      setFooterInView(entry?.isIntersecting ?? false),
    );
    watch.observe(footer);
    return () => watch.disconnect();
  }, []);
  return (
    <div className="site-nav-shell pointer-events-none fixed inset-x-0 top-4 z-50 px-4">
      <div className="site-nav-inner pointer-events-auto relative mx-auto w-full max-w-[820px]">
        <CardNav
          key={theme}
          logo={<WemaLogo />}
          logoAlt="Wema, accueil"
          logoHref="/"
          items={CARDS}
          cta={{
            label: (
              <>
                <span>Essai gratuit</span>
                <TsfArrow />
              </>
            ),
            href: signupHref,
            className: 'tk-cta',
          }}
          ctaNode={<FocusFrameButton href={signupHref}>Essai gratuit</FocusFrameButton>}
          theme={theme}
          surface="glass"
          maxWidth={820}
          cardHeight={236}
          className="tk-nav"
          style={TOKENS}
          linkComponent={Link}
          renderLinks={flowingLinks}
          footerRow={quickRow}
          barExtra={
            <span className="lg:hidden">
              <ThemeToggle size="sm" />
            </span>
          }
        />
      </div>
      <div
        aria-hidden={footerInView || undefined}
        data-aside="corner"
        className={`hero-aside fixed bottom-5 left-5 z-50 hidden transition-opacity lg:flex duration-300 ${footerInView ? 'pointer-events-none opacity-0' : 'pointer-events-auto'} items-center gap-2 rounded-full border border-border bg-background/85 py-1 pr-3 pl-1 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.35)] backdrop-blur-md`}
      >
        <ThemeToggle size="sm" />
        <span className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
          {dark ? 'Sombre' : 'Clair'}
        </span>
      </div>
    </div>
  );
}
