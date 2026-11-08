// @ts-nocheck
// biome-ignore-all lint: vendored from React Bits
// biome-ignore-all format: vendored from React Bits
'use client';

import { Children, Fragment, isValidElement, type ReactNode, useLayoutEffect, useRef } from 'react';
import s from './ScrollStack.module.css';

const resolveOffset = (value, size) => {
  if (typeof value === 'number') return value;
  const text = String(value).trim();
  if (text.endsWith('%')) return (parseFloat(text) / 100) * size;
  return parseFloat(text) || 0;
};

const toLength = value => (typeof value === 'number' ? `${value}px` : value);

const scrollsInside = (node, stop, delta) => {
  for (let element = node; element && element !== stop; element = element.parentElement) {
    if (element.scrollHeight <= element.clientHeight + 1) continue;
    const overflow = getComputedStyle(element).overflowY;
    if (overflow !== 'auto' && overflow !== 'scroll') continue;
    if (delta > 0 ? element.scrollTop + element.clientHeight < element.scrollHeight - 1 : element.scrollTop > 0) {
      return true;
    }
  }
  return false;
};

export const ScrollStackItem = ({ children, id }: { children: ReactNode; id?: string }) => (
  <div className={s.card} data-stack-card="" id={id}>
    {children}
  </div>
);

type ScrollStackProps = {
  children: ReactNode;
  className?: string;
  itemDistance?: number;
  itemStackDistance?: number;
  stackPosition?: number | string;
  itemScale?: number;
  baseScale?: number;
  dimAmount?: number;
  blurAmount?: number;
  holdDistance?: number;
  smoothScroll?: boolean;
  snap?: boolean;
  media?: string;
  onStackComplete?: () => void;
};

const ScrollStack = ({
  children,
  className = '',
  itemDistance = 100,
  itemStackDistance = 24,
  stackPosition = '15%',
  itemScale = 0.05,
  baseScale = 0.8,
  dimAmount = 0.2,
  blurAmount = 0,
  holdDistance = 200,
  smoothScroll = true,
  snap = false,
  media = '(min-width: 1024px)',
  onStackComplete
}: ScrollStackProps) => {
  const rootRef = useRef(null);
  const innerRef = useRef(null);
  const endRef = useRef(null);
  const settingsRef = useRef(null);
  const scheduleRef = useRef(null);
  const items = Children.toArray(children);

  useLayoutEffect(() => {
    settingsRef.current = {
      itemDistance,
      itemStackDistance,
      stackPosition,
      itemScale,
      baseScale,
      dimAmount,
      blurAmount,
      holdDistance,
      smoothScroll,
      snap,
      onStackComplete
    };
    scheduleRef.current?.();
  });

  useLayoutEffect(() => {
    const root = rootRef.current;
    const inner = innerRef.current;
    const end = endRef.current;
    if (!root || !inner || !end) return undefined;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const wide = window.matchMedia(media);
    const cache = new Map();
    let frame = 0;
    let glide = 0;
    let rest = 0;
    let complete = false;
    let gliding = false;
    let pressed = false;
    let current = 0;
    let goal = 0;
    let written = 0;
    let last = 0;
    let points = [];
    let reach = 0;

    const readScroll = () => window.scrollY;
    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
    const writeScroll = value => {
      written = value;
      window.scrollTo({ top: value, behavior: 'instant' });
    };
    const onScreen = () => {
      const box = root.getBoundingClientRect();
      return box.top < window.innerHeight && box.bottom > 0;
    };

    const write = (key, value, apply) => {
      if (cache.get(key) === value) return false;
      cache.set(key, value);
      apply(value);
      return true;
    };

    const update = () => {
      frame = 0;
      const settings = settingsRef.current;
      const slots = Array.from(inner.children).filter(child => child.hasAttribute('data-stack-slot'));
      if (!settings || !slots.length) return;
      const on = wide.matches;

      const viewHeight = window.innerHeight;
      const stackTop = resolveOffset(settings.stackPosition, viewHeight);
      const offset = settings.itemStackDistance;
      const heights = slots.map(slot => slot.offsetHeight);
      const tops = slots.map(slot => slot.getBoundingClientRect().top);

      const moved = write('endHeight', settings.holdDistance, value => {
        end.style.height = `${value}px`;
      });

      let flow = inner.getBoundingClientRect().top + readScroll();
      points = heights.map((height, i) => {
        const point = flow - stackTop - i * offset;
        flow += height + settings.itemDistance;
        return point;
      });
      reach = Math.max(40, (heights[0] + settings.itemDistance - offset) / 2);

      const depths = slots.map(() => 0);
      let lastCover = 0;
      for (let j = 1; j < slots.length; j++) {
        const pinBefore = stackTop + (j - 1) * offset;
        const start = pinBefore + heights[j - 1];
        const span = Math.max(1, start - pinBefore - offset);
        const cover = on ? Math.min(1, Math.max(0, (start - tops[j]) / span)) : 0;
        for (let i = 0; i < j; i++) depths[i] += cover;
        lastCover = cover;
      }

      const dimStep = Math.min(Math.max(settings.dimAmount, 0), 1);
      slots.forEach((slot, i) => {
        const card = slot.firstElementChild;
        if (!card) return;
        const depth = motion.matches ? 0 : depths[i];
        const scale = Math.max(Math.min(settings.baseScale, 1), 1 - depth * settings.itemScale);
        const blur = depth * settings.blurAmount;
        const dim = 1 - Math.pow(1 - dimStep, depths[i]);
        write(`transform${i}`, depth < 0.0005 ? '' : `scale(${scale.toFixed(4)})`, value => {
          card.style.transform = value;
        });
        write(`filter${i}`, blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : '', value => {
          card.style.filter = value;
        });
        write(`dim${i}`, dim.toFixed(3), value => {
          card.style.setProperty('--scroll-stack-dim', value);
        });
      });

      const done = slots.length > 1 && lastCover >= 0.999;
      if (done !== complete) {
        complete = done;
        if (done) settings.onStackComplete?.();
      }

      if (moved) schedule();
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const step = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (Math.abs(readScroll() - written) > 2) {
        gliding = false;
        glide = 0;
        settleSoon();
        return;
      }
      current += (goal - current) * (1 - Math.pow(0.9, dt * 60));
      if (Math.abs(goal - current) < 0.5) current = goal;
      writeScroll(current);
      if (current === goal) {
        gliding = false;
        glide = 0;
        settleSoon();
        return;
      }
      glide = requestAnimationFrame(step);
    };

    const glideTo = value => {
      goal = Math.min(Math.max(value, 0), maxScroll());
      if (motion.matches) {
        writeScroll(goal);
        return;
      }
      if (gliding) return;
      gliding = true;
      current = readScroll();
      written = current;
      last = performance.now();
      glide = requestAnimationFrame(step);
    };

    const settle = () => {
      rest = 0;
      if (!settingsRef.current?.snap || !wide.matches || gliding || pressed || !points.length) return;
      const now = readScroll();
      const nearest = points.reduce((best, point) => (Math.abs(point - now) < Math.abs(best - now) ? point : best));
      const gap = Math.abs(nearest - now);
      if (gap > 1 && gap < reach) glideTo(nearest);
    };

    const settleSoon = () => {
      window.clearTimeout(rest);
      rest = window.setTimeout(settle, 140);
    };

    const onScroll = () => {
      schedule();
      if (!gliding) settleSoon();
    };

    const onWheel = event => {
      if (!settingsRef.current?.smoothScroll || !wide.matches || motion.matches || event.defaultPrevented || event.ctrlKey) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (!gliding && !onScreen()) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (!delta || scrollsInside(event.target, document.body, delta)) return;
      const base = gliding ? goal : readScroll();
      if ((delta < 0 && base <= 0) || (delta > 0 && base >= maxScroll() - 0.5)) return;
      event.preventDefault();
      window.clearTimeout(rest);
      glideTo(base + delta);
    };

    const onPress = () => {
      pressed = true;
      window.clearTimeout(rest);
    };

    const onRelease = () => {
      if (!pressed) return;
      pressed = false;
      settleSoon();
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    observer.observe(inner);
    observer.observe(document.documentElement);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointerdown', onPress, { passive: true });
    window.addEventListener('pointerup', onRelease, { passive: true });
    window.addEventListener('pointercancel', onRelease, { passive: true });
    window.addEventListener('resize', schedule);
    wide.addEventListener('change', schedule);
    motion.addEventListener('change', schedule);
    scheduleRef.current = schedule;
    update();

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(glide);
      window.clearTimeout(rest);
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointerdown', onPress);
      window.removeEventListener('pointerup', onRelease);
      window.removeEventListener('pointercancel', onRelease);
      window.removeEventListener('resize', schedule);
      wide.removeEventListener('change', schedule);
      motion.removeEventListener('change', schedule);
      scheduleRef.current = null;
    };
  }, [media]);

  return (
    <div ref={rootRef} className={`${s.root} ${className}`.trim()}>
      <div ref={innerRef} className={s.inner}>
        {items.map((child, index) => {
          const gap = itemDistance - (items.length - index) * itemStackDistance;
          return (
            <Fragment key={isValidElement(child) ? (child.key ?? index) : index}>
              {index > 0 && (
                <div aria-hidden="true" className={s.gap} style={{ height: Math.max(0, gap), marginTop: Math.min(0, gap) }} />
              )}
              <div
                data-stack-slot=""
                className={s.slot}
                style={{
                  '--ss-top': `calc(${toLength(stackPosition)} + ${index * itemStackDistance}px)`,
                  '--ss-mb': `${(items.length - 1 - index) * itemStackDistance}px`,
                  '--ss-z': index + 1
                }}
              >
                {child}
              </div>
            </Fragment>
          );
        })}
        <div ref={endRef} className={s.end} aria-hidden="true" />
      </div>
    </div>
  );
};

export default ScrollStack;
