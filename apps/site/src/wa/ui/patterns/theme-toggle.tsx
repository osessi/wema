'use client';

import { Toggle } from '@base-ui/react/toggle';
import { Moon, Sun } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '../lib/utils';

export const THEME_STORAGE_KEY = 'wema_theme';
export const THEME_CHANGE_EVENT = 'wema:theme-change';
export type ThemePreference = 'light' | 'dark' | 'system';
type Preference = ThemePreference;

const EASE = 'ease-[cubic-bezier(0.68,-0.55,0.265,1.55)]';

export function readThemePreference(): Preference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function systemIsDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(preference: Preference): void {
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

export function setThemePreference(preference: Preference): void {
  try {
    if (preference === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {}
  applyTheme(preference);
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: preference }));
}

export function ThemeScript() {
  const code = `(function(){try{var v=localStorage.getItem('${THEME_STORAGE_KEY}');if(v==='light'||v==='dark'){document.documentElement.setAttribute('data-theme',v)}}catch(e){}})();`;
  // biome-ignore lint/security/noDangerouslySetInnerHtml: a constant string, no user input.
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export interface ThemeToggleProps {
  readonly className?: string | undefined;
  readonly size?: 'sm' | 'md' | undefined;
}

const SIZE = {
  sm: { track: 'h-6 w-11', knob: 'size-4', end: 'left-[calc(100%-1.125rem)]', icon: 11 },
  md: { track: 'h-7 w-13', knob: 'size-5', end: 'left-[calc(100%-1.375rem)]', icon: 13 },
} as const;

export function ThemeToggle({ className, size = 'md' }: ThemeToggleProps) {
  const [dark, setDark] = useState<boolean | null>(null);
  const config = SIZE[size];

  useEffect(() => {
    const preference = readThemePreference();
    setDark(preference === 'system' ? systemIsDark() : preference === 'dark');
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (readThemePreference() === 'system') setDark(media.matches);
    };
    media.addEventListener('change', onChange);
    const onPreference = (event: Event) => {
      const next = (event as CustomEvent<Preference>).detail;
      setDark(next === 'system' ? media.matches : next === 'dark');
    };
    window.addEventListener(THEME_CHANGE_EVENT, onPreference);
    return () => {
      media.removeEventListener('change', onChange);
      window.removeEventListener(THEME_CHANGE_EVENT, onPreference);
    };
  }, []);

  const onPressedChange = useCallback((pressed: boolean) => {
    setThemePreference(pressed ? 'dark' : 'light');
    setDark(pressed);
  }, []);

  if (dark === null) {
    return (
      <span
        aria-hidden="true"
        data-slot="theme-toggle"
        data-pending=""
        className={cn(
          'inline-block rounded-full border border-border bg-surface-subtle',
          config.track,
          className,
        )}
      />
    );
  }

  return (
    <Toggle
      aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      pressed={dark}
      onPressedChange={onPressedChange}
      className={cn(
        'relative cursor-pointer rounded-full border transition-colors duration-500 outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        EASE,
        config.track,
        dark ? 'border-dark-border bg-dark-surface-subtle' : 'border-border bg-surface-subtle',
        className,
      )}
      data-slot="theme-toggle"
    >
      <span
        className={cn(
          'absolute top-1/2 grid -translate-y-1/2 place-items-center rounded-full shadow-xs transition-[left,background-color] duration-500',
          EASE,
          config.knob,
          dark ? config.end : 'left-0.5',
          dark ? 'bg-dark-foreground text-dark-background' : 'bg-surface text-warning',
        )}
      >
        <Sun
          aria-hidden="true"
          size={config.icon}
          weight="fill"
          className={cn(
            'col-start-1 row-start-1 origin-center transition-[transform,opacity] duration-500',
            EASE,
            dark ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100',
          )}
        />
        <Moon
          aria-hidden="true"
          size={config.icon}
          weight="fill"
          className={cn(
            'col-start-1 row-start-1 origin-center transition-[transform,opacity] duration-500',
            EASE,
            dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0',
          )}
        />
      </span>
    </Toggle>
  );
}
