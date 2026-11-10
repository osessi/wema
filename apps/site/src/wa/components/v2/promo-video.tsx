'use client';

import { FilmSlate, Play, SpeakerSimpleSlash } from '@phosphor-icons/react';
import { cn } from '../../ui/lib/utils';
import { useEffect, useRef, useState } from 'react';
import type { Film } from '../../config/media';
import { ContourFrame } from './primitives';

/** Aperçu : en boucle sur les 5 premières secondes, sans le son. Son : la vidéo entière, avec le son. */
export type FilmMode = 'apercu' | 'son' | 'pause';
const APERCU_S = 5;

/** Une seule source sonore à la fois sur la page. */
export const SON_EVENT = 'wema-son';
export function annoncerSon(source: string) {
  window.dispatchEvent(new CustomEvent(SON_EVENT, { detail: source }));
}

export function FilmFace({
  film,
  mode,
  muted = false,
  onEnded,
}: {
  readonly film: Film;
  readonly mode: FilmMode;
  readonly muted?: boolean;
  readonly onEnded?: () => void;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const dernierMode = useRef<FilmMode>('pause');
  useEffect(() => {
    const v = video.current;
    if (v === null) return;
    if (mode === 'pause') {
      v.pause();
      return;
    }
    v.muted = mode === 'apercu' || muted;
    if (dernierMode.current !== mode) v.currentTime = 0;
    dernierMode.current = mode;
    void v.play().catch(() => undefined);
  }, [mode, muted]);

  if (film.src === null) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#121005] bg-[radial-gradient(80%_60%_at_50%_100%,rgb(255_197_41/0.4),transparent_70%)] px-6 text-center">
        <FilmSlate className="size-8 text-brand" aria-hidden="true" />
        <span className="font-mono text-[11px] font-medium tracking-[0.08em] text-white/60 uppercase">
          Vidéo en préparation
        </span>
        <span className="text-balance text-[16px] leading-snug font-medium text-white">
          « {film.title} »
        </span>
      </div>
    );
  }
  return (
    <video
      ref={video}
      className="absolute inset-0 size-full bg-[#121005] object-cover"
      src={film.src}
      poster={film.poster ?? undefined}
      muted
      playsInline
      preload="metadata"
      onTimeUpdate={(e) => {
        if (mode === 'apercu' && e.currentTarget.currentTime >= APERCU_S)
          e.currentTarget.currentTime = 0;
      }}
      onEnded={(e) => {
        if (mode === 'son') onEnded?.();
        else void e.currentTarget.play().catch(() => undefined);
      }}
      aria-label={`${film.label} : ${film.title}`}
    />
  );
}

export function PromoVideo({
  film,
  format = 'landscape',
  caption = false,
}: {
  readonly film: Film;
  readonly format?: 'landscape' | 'portrait';
  readonly caption?: boolean;
}) {
  const box = useRef<HTMLElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const [inView, setInView] = useState(false);
  const [withSound, setWithSound] = useState(false);
  const portrait = format === 'portrait';

  useEffect(() => {
    const el = box.current;
    if (el === null) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const couper = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== film.id) video.current?.pause();
    };
    window.addEventListener(SON_EVENT, couper);
    return () => window.removeEventListener(SON_EVENT, couper);
  }, [film.id]);

  useEffect(() => {
    const v = video.current;
    if (!inView || v === null || withSound) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) void v.play().catch(() => undefined);
  }, [inView, withSound]);

  function playWithSound() {
    const v = video.current;
    if (v === null) return;
    setWithSound(true);
    annoncerSon(film.id);
    v.muted = false;
    v.loop = false;
    v.currentTime = 0;
    void v.play().catch(() => undefined);
  }

  return (
    <figure ref={box} className="flex flex-col gap-4">
      <ContourFrame className="relative">
        <div
          className={cn(
            'relative w-full bg-[#121005]',
            portrait ? 'aspect-[9/16]' : 'aspect-video',
          )}
        >
          {film.src === null ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(80%_60%_at_50%_100%,rgb(255_197_41/0.35),transparent_70%)] px-6 text-center">
              <FilmSlate
                className={cn('text-brand', portrait ? 'size-8' : 'size-11')}
                aria-hidden="true"
              />
              <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-white/60 uppercase">
                Vidéo en préparation
              </span>
              <span
                className={cn(
                  'text-balance leading-snug font-medium text-white',
                  portrait ? 'text-[16px]' : 'text-[22px] sm:text-[28px]',
                )}
              >
                {portrait ? `« ${film.title} »` : film.title}
              </span>
            </div>
          ) : (
            <>
              <video
                ref={video}
                className="absolute inset-0 size-full object-cover"
                poster={film.poster ?? undefined}
                muted={!withSound}
                loop={!withSound}
                playsInline
                controls={withSound}
                preload="none"
                src={inView ? film.src : undefined}
                aria-label={`${film.label} : ${film.title}`}
              />
              {withSound ? null : (
                <button
                  type="button"
                  onClick={playWithSound}
                  className="group absolute inset-0 flex items-end justify-start p-4 sm:p-6"
                  aria-label="Lire la vidéo avec le son"
                >
                  <span className="inline-flex items-center gap-3 rounded-[10px] bg-[#0D0E0B]/85 py-2 pr-3.5 pl-2 text-[14px] font-medium text-white shadow-lg backdrop-blur transition-transform duration-200 group-hover:-translate-y-0.5">
                    <span className="grid size-8 place-items-center rounded-[8px] bg-brand text-[#1a1403]">
                      <Play weight="fill" className="size-4" />
                    </span>
                    {portrait
                      ? `${film.duration} s`
                      : `Regarder · ${Math.round(film.duration / 60)} min`}
                    <SpeakerSimpleSlash className="size-4 opacity-60" aria-hidden="true" />
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </ContourFrame>
      {caption ? (
        <figcaption className="flex flex-col gap-1 px-1">
          <span className="font-mono text-[11.5px] font-medium tracking-[0.08em] text-foreground/60 uppercase">
            {film.label}
          </span>
          <span className="text-[15px] leading-snug font-medium text-foreground">{film.title}</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
