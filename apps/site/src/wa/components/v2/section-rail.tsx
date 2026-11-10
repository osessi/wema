'use client';

import { useEffect, useState } from 'react';
import { useDark } from '../../lib/use-dark';
import LineSidebar from '../reactbits/LineSidebar';

const CHAPTERS: readonly { label: string; id: string }[] = [
  { label: 'Accueil', id: 'top' },
  { label: 'En une minute', id: 'presentation' },
  { label: 'Matières', id: 'matieres' },
  { label: 'Méthode', id: 'methode' },
  { label: 'Parents', id: 'parents' },
  { label: 'Profs et écoles', id: 'profs' },
  { label: 'Offre', id: 'offre' },
  { label: 'FAQ', id: 'faq' },
];

function chapterOnScreen(): number {
  const middle = window.innerHeight / 2;
  let current = 0;
  CHAPTERS.forEach((chapter, index) => {
    const el = document.getElementById(chapter.id);
    if (el === null || el.getClientRects().length === 0) return;
    const box = el.getBoundingClientRect();
    if (box.height === 0) return;
    if (box.top <= middle) current = index;
  });
  return current;
}

export function SectionRail() {
  const dark = useDark();
  const [footerInView, setFooterInView] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const footer = document.querySelector('footer');
    if (footer === null) return;
    const observer = new IntersectionObserver(([entry]) =>
      setFooterInView(entry?.isIntersecting ?? false),
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setActive(chapterOnScreen()));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <nav
      aria-label="Chapitres de la page"
      aria-hidden={footerInView}
      data-aside="rail"
      className={`hero-aside fixed top-1/2 left-3 z-40 hidden -translate-y-1/2 transition-opacity duration-300 lg:block ${footerInView ? 'pointer-events-none opacity-0' : ''}`}
    >
      <LineSidebar
        key={active}
        items={CHAPTERS.map((c) => c.label)}
        accentColor="#B88700"
        textColor={dark ? '#9DA095' : '#74746D'}
        markerColor={dark ? '#2B2E25' : '#C9C7BF'}
        fontSize={0.78}
        itemGap={12}
        markerLength={24}
        maxShift={16}
        defaultActive={active}
        onItemClick={(index) => {
          const id = CHAPTERS[index]?.id;
          if (id === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
          else if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        }}
      />
    </nav>
  );
}
