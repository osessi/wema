"use client";

import {
  ActiveMarker,
  ActiveMarkerGroup,
  type AnimatedIconHandle,
  GlowTile,
} from "@wema/ui/brand";
import Link from "next/link";
import { useRef } from "react";
import type { ShellNavItem } from "./app-shell";
import { NAV_ICONS, NAV_TONES } from "./icons";

function Tab({
  item,
  active,
  count,
}: {
  item: ShellNavItem;
  active: boolean;
  count: number;
}) {
  const Icon = NAV_ICONS[item.icon];
  const gesture = useRef<AnimatedIconHandle>(null);
  return (
    <li className="relative min-w-0 flex-1">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        onPointerDown={() => gesture.current?.start()}
        className="relative flex h-full flex-col items-center justify-center gap-1 rounded-md px-1 pt-2 pb-1.5 text-[11px] leading-none font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:text-foreground"
      >
        {active && (
          <ActiveMarker
            layoutId="shell-tab-active"
            className="inset-x-3 top-0 h-[3px] rounded-b-full bg-brand"
          />
        )}
        <span className="relative">
          <GlowTile
            tone={NAV_TONES[item.icon]}
            size={26}
            glyph="62%"
            lit={active}
          >
            <Icon ref={gesture} size={16} className="pointer-events-none" />
          </GlowTile>
          {count > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 font-mono text-[10px] font-semibold text-ink-on-brand ring-2 ring-background"
            >
              {count > 9 ? "9+" : count}
            </span>
          )}
        </span>
        <span className="w-full truncate text-center">{item.label}</span>
      </Link>
    </li>
  );
}

/**
 * Barre d'onglets du téléphone (masquée dès 768 px) : cinq entrées au plus,
 * chacune avec sa pastille, et une barre jaune qui glisse vers l'onglet actif.
 * `unread` : nombre de non-lus par adresse (pastille sur l'onglet).
 */
export function MobileTabBar({
  items,
  activeHref,
  label,
  unread = {},
}: {
  items: ShellNavItem[];
  activeHref: string | undefined;
  label: string;
  unread?: Record<string, number>;
}) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/75 md:hidden"
    >
      <ActiveMarkerGroup id="shell-tabs">
        <ul className="mx-auto flex h-16 max-w-lg items-stretch gap-1 px-2">
          {items.map((item) => (
            <Tab
              key={item.href}
              item={item}
              active={item.href === activeHref}
              count={unread[item.href] ?? 0}
            />
          ))}
        </ul>
      </ActiveMarkerGroup>
    </nav>
  );
}
