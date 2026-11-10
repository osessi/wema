"use client";

import { Sparkle } from "@phosphor-icons/react";
import {
  type AnimatedIcon,
  BellIcon,
  BooksIcon,
  BroadcastIcon,
  CalendarCheckIcon,
  ChartLineUpIcon,
  ChatsCircleIcon,
  DatabaseIcon,
  EnvelopeIcon,
  GearIcon,
  GLOW_TONE_NAMES,
  GlobeIcon,
  GlowIcon,
  type GlowIdle,
  GlowTile,
  HandshakeIcon,
  HouseIcon,
  KanbanIcon,
  MagnifyingGlassIcon,
  TargetIcon,
  UsersThreeIcon,
} from "@wema/ui/brand";
import { Section, Specimen } from "../_components/section";
import type { SectionProps } from "../_components/showcase";

const ANIMATED: [string, AnimatedIcon][] = [
  ["Accueil", HouseIcon],
  ["Notifications", BellIcon],
  ["Messages", EnvelopeIcon],
  ["Discussions", ChatsCircleIcon],
  ["Élèves", UsersThreeIcon],
  ["Progression", ChartLineUpIcon],
  ["Agenda", CalendarCheckIcon],
  ["Banque", BooksIcon],
  ["Objectif", TargetIcon],
  ["Recherche", MagnifyingGlassIcon],
  ["Tableau", KanbanIcon],
  ["Annonce", BroadcastIcon],
  ["Partenaires", HandshakeIcon],
  ["Pays", GlobeIcon],
  ["Données", DatabaseIcon],
  ["Réglages", GearIcon],
];

const IDLES: GlowIdle[] = ["none", "breathe", "orbit", "shimmer"];

export function Icons({ id, index, title }: SectionProps) {
  return (
    <Section
      id={id}
      index={index}
      title={title}
      when="Les icônes viennent de Phosphor. La pastille GlowTile met un glyphe en valeur (en-tête de carte, état vide, menu) ; son ton suit le sens. Les icônes animées s'animent au survol, et se taisent si l'on réduit les animations."
    >
      <Specimen label="Pastilles · GlowTile, tous les tons">
        <ul className="grid grid-cols-3 gap-6 sm:grid-cols-6">
          {GLOW_TONE_NAMES.map((tone) => (
            <li key={tone} className="flex flex-col items-center gap-3">
              <GlowTile tone={tone} size={56}>
                <Sparkle weight="fill" />
              </GlowTile>
              <span className="font-mono text-[11px] text-muted-foreground">
                {tone}
              </span>
            </li>
          ))}
        </ul>
      </Specimen>

      <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
        <Specimen label="Tailles et animations au repos">
          <div className="flex flex-col gap-6">
            <div className="flex items-end gap-4">
              {[24, 32, 40, 56, 72].map((s) => (
                <GlowTile
                  key={s}
                  tone="yellow"
                  size={s}
                  glyph={s === 24 ? "64%" : undefined}
                >
                  <Sparkle weight="fill" />
                </GlowTile>
              ))}
            </div>
            <ul className="flex flex-wrap gap-6">
              {IDLES.map((idle, i) => (
                <li key={idle} className="flex flex-col items-center gap-2">
                  <GlowTile
                    tone={GLOW_TONE_NAMES[i + 1] ?? "sky"}
                    size={48}
                    idle={idle}
                  >
                    <Sparkle weight="fill" />
                  </GlowTile>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {idle}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Specimen>

        <Specimen
          label="Icônes animées · GlowIcon"
          note="Survolez une pastille"
        >
          <ul className="grid grid-cols-4 gap-x-4 gap-y-6 sm:grid-cols-8">
            {ANIMATED.map(([label, icon], i) => (
              <li
                key={label}
                className="flex flex-col items-center gap-2 text-center"
              >
                <GlowIcon
                  icon={icon}
                  size={48}
                  tone={GLOW_TONE_NAMES[i % GLOW_TONE_NAMES.length] ?? "yellow"}
                />
                <span className="text-xs text-muted-foreground">{label}</span>
              </li>
            ))}
          </ul>
        </Specimen>
      </div>
    </Section>
  );
}
