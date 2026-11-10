'use client';

import { cn } from '../../ui/lib/utils';
import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import { signupHref } from '../../config/site';
import { WemaLogo } from '../site/wema-logo';
import { hero } from '../../content/hero';
import SlantMorphButton from '../tweenui/slant-morph-button';
import { HeroField } from './hero/hero-field';
import { HeroTitle } from './hero/hero-title';
import { HeroTrustLine } from './hero/hero-trust-line';

function StatusPill({ dark = false }: { readonly dark?: boolean }) {
  return (
    <div
      className="tk-frame inline-block"
      style={
        {
          '--c': '7px',
          '--tk-edge': '#ffc529',
        } as CSSProperties
      }
    >
      <p
        className={cn(
          'tk-frame-cut relative inline-flex items-center gap-2.5 py-1.5 pr-3.5 pl-3 text-[12.5px] backdrop-blur-md',
          dark ? 'bg-white/40 text-[#0D0E0B]/85' : 'bg-white/[0.06] text-white/85',
        )}
      >
        <span className="relative grid size-2 place-items-center" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-[#ffc529]/50 motion-safe:animate-ping" />
          <span className="size-1.5 rounded-full bg-[#ffc529] shadow-[0_0_8px_#ffc529]" />
        </span>
        <span className="font-medium">{hero.pill.status}</span>
        <span aria-hidden="true" className="tk-frame-rim" />
      </p>
    </div>
  );
}

function useAsideFlags(frame: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const update = () => {
      const el = frame.current;
      if (el === null) return;
      const { bottom } = el.getBoundingClientRect();
      const h = window.innerHeight;
      root.toggleAttribute('data-hero-under-rail', bottom > h / 2 + 160);
      root.toggleAttribute('data-hero-under-corner', bottom > h - 72);
      root.toggleAttribute('data-hero-at-top', el.getBoundingClientRect().top > -40);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    const layout = new ResizeObserver(onScroll);
    layout.observe(document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      layout.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      root.removeAttribute('data-hero-under-rail');
      root.removeAttribute('data-hero-under-corner');
      root.removeAttribute('data-hero-at-top');
    };
  }, [frame]);
}

export type HeroInk = 'light' | 'dark';

export function Hero({
  field,
  headInk = 'light',
  footInk = 'light',
  narrowTitle = false,
  aside,
}: {
  readonly aside?: ReactNode;
  readonly field?: ReactNode;
  readonly headInk?: HeroInk;
  readonly footInk?: HeroInk;
  readonly narrowTitle?: boolean;
} = {}) {
  const headDark = headInk === 'dark';
  const footDark = footInk === 'dark';
  const frame = useRef<HTMLDivElement>(null);
  useAsideFlags(frame);
  return (
    <section className="relative px-2 pt-[88px] pb-2 sm:px-3 sm:pt-[96px] sm:pb-3 lg:pt-3">
      <div
        ref={frame}
        id="top"
        className="tk-frame"
        style={{ '--c': '22px', '--tk-edge': 'rgb(255 255 255 / 0.14)' } as CSSProperties}
      >
        <div className="tk-frame-cut relative isolate flex min-h-[max(calc(100svh-96px),600px)] flex-col overflow-hidden rounded-[20px] text-white sm:min-h-[max(calc(100svh-108px),560px)] lg:min-h-[max(calc(100svh-24px),620px)]">
          {field ?? <HeroField />}

          <div className="relative px-5 pt-6 sm:px-10 sm:pt-12 lg:px-14 lg:pt-14">
            <WemaLogo
              className={cn(
                'mb-[clamp(40px,13svh,150px)] hidden h-9 w-auto lg:block',
                headDark ? 'text-[#0D0E0B]' : 'text-white',
              )}
            />
            <StatusPill dark={headDark} />
            <HeroTitle
              className={cn(
                headDark && 'text-[#0D0E0B]',
                'mt-4 max-w-[16ch] text-[34px] leading-[1.05] font-light tracking-[-0.045em] text-balance sm:mt-7 sm:text-[clamp(40px,min(4.1vw,7.4svh),62px)] sm:leading-[1.02]',
                narrowTitle ? 'sm:max-w-[12ch]' : 'sm:max-w-none',
              )}
              segments={[
                { text: `${hero.headline.lead} `, className: 'sm:block' },
                {
                  text: hero.headline.accent,
                  className: cn(
                    'lg:whitespace-nowrap',
                    headDark ? 'text-[#7a3d00]' : 'text-[#ffe08a]',
                  ),
                },
                { text: ' ' },
                { text: `${hero.headline.always}.`, className: 'whitespace-nowrap' },
              ]}
            />
          </div>

          <div className="relative mt-auto flex flex-col-reverse gap-8 px-5 pt-8 pb-5 sm:px-10 sm:pb-10 lg:flex-row lg:items-end lg:justify-between lg:px-14 lg:pb-12">
            {aside === undefined ? null : <div className="w-full max-w-[400px]">{aside}</div>}
            <div className="flex max-w-[540px] flex-col items-start gap-5 sm:gap-6 lg:items-end lg:text-right">
              <p
                className={cn(
                  'text-[17px] leading-relaxed font-medium text-pretty sm:text-[20px] lg:text-balance',
                  footDark ? 'text-[#0D0E0B]/90' : 'text-white/95',
                )}
              >
                {hero.summary}{' '}
                <span
                  className={cn(
                    'font-semibold lg:whitespace-nowrap',
                    footDark ? 'text-[#7a3d00]' : 'text-[#ffe08a]',
                  )}
                >
                  {hero.price}
                </span>
              </p>
              <SlantMorphButton href={signupHref}>{hero.cta}</SlantMorphButton>
              <HeroTrustLine dark={footDark} />
            </div>
          </div>
          <span aria-hidden="true" className="tk-frame-rim" />
        </div>
      </div>
    </section>
  );
}
