'use client';

import type { GlowTone } from '../../../ui/components/ui/glow-tile';
import {
  BroadcastIcon,
  CalendarCheckIcon,
  ChatsCircleIcon,
  CursorClickIcon,
  GlobeIcon,
  MagnifyingGlassIcon,
  TargetIcon,
} from '../../../ui/icons';
import { cn } from '../../../ui/lib/utils';
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { Plan } from '../../../config/pricing';
import { GlowIcon } from '../glow-icon';

type Icon = ComponentProps<typeof GlowIcon>['icon'];

interface Crop {
  readonly src: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface Include {
  readonly title: string;
  readonly line: string;
  readonly icon: Icon;
  readonly tone: GlowTone;
  readonly caption: string;
  readonly crop?: Crop;
  readonly logos?: readonly { readonly src: string; readonly name: string }[];
  readonly code?: readonly string[];
}

const CAPTURE_W = 1600;
const CAPTURE_H = 1114;

const SOCIAL = [
  { src: '/brands/facebook.svg', name: 'Facebook' },
  { src: '/brands/instagram.svg', name: 'Instagram' },
] as const;

const per = (n: number, what: string) => `${n} ${what}${n > 1 ? 's' : ''} par semaine`;

function planIncludes(plan: Plan): readonly Include[] {
  const extra = plan.extraNetworks.map((network) =>
    network === 'youtube'
      ? { src: '/brands/youtube.svg', name: 'YouTube' }
      : { src: '/brands/linkedin.svg', name: 'LinkedIn' },
  );
  const lines: Include[] = [
    {
      title: 'Vidéos',
      line: `${per(plan.videosPerWeek, 'vidéo')}, écrites et montées pour vous.`,
      icon: BroadcastIcon,
      tone: 'indigo',
      caption: `Facebook, Instagram, TikTok${extra.length > 0 ? ', YouTube Shorts, LinkedIn' : ''}`,
      logos: [...SOCIAL, ...extra],
    },
    {
      title: 'Fiche Google',
      line: `${per(plan.googlePostsPerWeek, 'publication')} sur votre fiche.`,
      icon: MagnifyingGlassIcon,
      tone: 'gold',
      caption: 'Google Business Profile',
      logos: [{ src: '/brands/google.svg', name: 'Google' }],
    },
    {
      title: 'Messages',
      line: 'Réponses aux commentaires et aux messages.',
      icon: ChatsCircleIcon,
      tone: 'orchid',
      caption: 'Les demandes importantes vous sont transmises',
      logos: [...SOCIAL],
    },
    {
      title: 'Validation',
      line: 'Vous validez le planning avant chaque publication.',
      icon: CalendarCheckIcon,
      tone: 'ember',
      caption: 'Rien ne part sans votre accord',
    },
  ];
  if (plan.reviews) {
    lines.push({
      title: 'Avis clients',
      line: 'Collecte d’avis pour votre fiche Google.',
      icon: TargetIcon,
      tone: 'crimson',
      caption: 'Des avis récents, régulièrement',
      logos: [{ src: '/brands/google.svg', name: 'Google' }],
    });
  }
  if (plan.website) {
    lines.push({
      title: 'Site internet',
      line: 'Votre site, offert avec la formule.',
      icon: GlobeIcon,
      tone: 'emerald',
      caption: 'Conçu par Winner Agency',
    });
  }
  lines.push({
    title: 'Un canal en plus',
    line: 'Ajoutez un réseau à tout moment.',
    icon: CursorClickIcon,
    tone: 'indigo',
    caption: '49 € par mois et par canal',
  });
  return lines;
}

const PREVIEW_W = 360;
const GAP = 10;
const EDGE = 12;

function CropImage({ crop }: { readonly crop: Crop }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-[10px] border border-foreground/10 bg-white"
      style={{ aspectRatio: `${crop.w} / ${crop.h}` }}
    >
      {/* biome-ignore lint/performance/noImgElement: a static crop of a prerendered capture. */}
      <img
        src={crop.src}
        alt=""
        loading="lazy"
        className="absolute max-w-none"
        style={{
          width: `${(CAPTURE_W / crop.w) * 100}%`,
          height: `${(CAPTURE_H / crop.h) * 100}%`,
          left: `${(-crop.x / crop.w) * 100}%`,
          top: `${(-crop.y / crop.h) * 100}%`,
        }}
      />
    </div>
  );
}

function PreviewBody({ item }: { readonly item: Include }) {
  return (
    <div className="flex flex-col gap-3">
      {item.crop === undefined ? null : <CropImage crop={item.crop} />}
      {item.code === undefined ? null : (
        <pre className="overflow-hidden rounded-[10px] bg-[#151610] p-3.5 font-mono text-[11px] leading-[1.6] text-[#F5F6F0]/85">
          {item.code.map((line, index) => (
            <span
              key={line === '' ? 'blank' : line}
              className={cn('block min-h-[1.6em]', index === 0 && 'text-[#ffc529]')}
            >
              {line}
            </span>
          ))}
        </pre>
      )}
      {item.logos !== undefined && item.crop === undefined ? (
        <div className="grid grid-cols-4 gap-2">
          {item.logos.map((logo) => (
            <div
              key={logo.src}
              className="flex flex-col items-center gap-1.5 rounded-[10px] border border-foreground/10 bg-background px-1 py-3"
            >
              {/* biome-ignore lint/performance/noImgElement: a small brand mark. */}
              <img src={logo.src} alt="" width={26} height={26} className="size-[26px]" />
              <span className="text-[11px] font-medium text-foreground/70">{logo.name}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] font-medium tracking-[0.08em] text-foreground/55 uppercase">
          {item.caption}
        </span>
        {item.logos !== undefined && item.crop !== undefined ? (
          <span className="flex items-center gap-1.5">
            {item.logos.map((logo) => (
              <span
                key={logo.src}
                className="flex size-7 items-center justify-center rounded-[8px] border border-foreground/10 bg-background"
              >
                {/* biome-ignore lint/performance/noImgElement: a small brand mark. */}
                <img src={logo.src} alt="" width={16} height={16} className="size-4" />
              </span>
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Preview({
  item,
  anchor,
  open,
  id,
}: {
  readonly item: Include;
  readonly anchor: HTMLElement | null;
  readonly open: boolean;
  readonly id: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; below: boolean } | null>(null);

  const measure = useCallback(() => {
    const node = ref.current;
    if (anchor === null || node === null) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(PREVIEW_W, window.innerWidth - EDGE * 2);
    const height = node.offsetHeight;
    const left = Math.min(Math.max(rect.left, EDGE), window.innerWidth - width - EDGE);
    const below = rect.top - height - GAP < EDGE;
    const top = below ? rect.bottom + GAP : rect.top - height - GAP;
    setPlace({ left, top, below });
  }, [anchor]);

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [open, measure]);

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      data-open={open && place !== null ? '' : undefined}
      data-below={place?.below ? '' : undefined}
      className="pz-preview pointer-events-none fixed z-[80] w-[min(360px,calc(100vw-24px))]"
      style={{ left: place?.left ?? -9999, top: place?.top ?? -9999 }}
    >
      <div className="rounded-[18px] border border-foreground/12 bg-background p-[5px] shadow-[0_24px_60px_-24px_rgb(13_14_11/0.45),0_2px_6px_rgb(13_14_11/0.08)]">
        <div className="rounded-[14px] border border-foreground/10 bg-surface p-3">
          <PreviewBody item={item} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

const includesStyles = `
.pz-preview { opacity: 0; transform: translateY(6px) scale(0.97); transform-origin: 30% 100%; transition: opacity 0.18s ease, transform 0.24s var(--tk-ease, ease); visibility: hidden; }
.pz-preview[data-below] { transform: translateY(-6px) scale(0.97); transform-origin: 30% 0; }
.pz-preview[data-open] { opacity: 1; transform: none; visibility: visible; }
@media (prefers-reduced-motion: reduce) {
  .pz-preview, .pz-preview[data-below] { transform: none; transition: opacity 0.12s linear; }
}
`;

function IncludeRow({
  item,
  index,
  open,
  onOpen,
  onClose,
  mounted,
}: {
  readonly item: Include;
  readonly index: number;
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly mounted: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const previewId = useId();
  const pointer = useRef<string | null>(null);
  return (
    <li className="border-t border-foreground/10 first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
      <button
        ref={ref}
        type="button"
        data-include
        aria-expanded={open}
        aria-describedby={open ? previewId : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') onOpen();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') onClose();
        }}
        onPointerDown={(event) => {
          pointer.current = event.pointerType;
        }}
        onFocus={() => {
          if (pointer.current === null) onOpen();
        }}
        onBlur={onClose}
        onClick={() => {
          const kind = pointer.current;
          pointer.current = null;
          if (kind === 'mouse' || !open) onOpen();
          else onClose();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
        className={cn(
          'group/inc -mx-3 flex w-[calc(100%+24px)] cursor-pointer items-start gap-4 rounded-[14px] px-3 py-4 text-left transition-colors outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand)_40%,transparent)]',
          open ? 'bg-foreground/[0.04]' : 'hover:bg-foreground/[0.04]',
        )}
      >
        <GlowIcon tone={item.tone} icon={item.icon} size={44} className="shrink-0" />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-medium text-foreground/45 tabular-nums">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">
              {item.title}
            </span>
          </span>
          <span className="text-[15px] leading-snug text-foreground/75">{item.line}</span>
        </span>
      </button>
      {mounted ? <Preview item={item} anchor={ref.current} open={open} id={previewId} /> : null}
    </li>
  );
}

export function PricingIncludes({ plan }: { readonly plan: Plan }) {
  const items = planIncludes(plan);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const closeTimer = useRef<number | null>(null);
  useEffect(() => setMounted(true), []);

  const open = useCallback((index: number) => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setOpenIndex(index);
  }, []);
  const close = useCallback((index: number) => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setOpenIndex((current) => (current === index ? null : current));
    }, 80);
  }, []);

  useEffect(() => {
    if (openIndex === null) return;
    const onDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest('[data-include]') === null) {
        setOpenIndex(null);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [openIndex]);

  return (
    <>
      <style>{includesStyles}</style>
      <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
        {items.map((item, index) => (
          <IncludeRow
            key={item.title}
            item={item}
            index={index}
            open={openIndex === index}
            onOpen={() => open(index)}
            onClose={() => close(index)}
            mounted={mounted}
          />
        ))}
      </ul>
    </>
  );
}
