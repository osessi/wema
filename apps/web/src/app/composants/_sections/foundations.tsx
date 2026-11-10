"use client";

import { Button } from "@wema/ui/components/ui/button";
import { cn } from "@wema/ui/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Section, Specimen } from "../_components/section";
import type { SectionProps } from "../_components/showcase";

const GROUPS: { name: string; tokens: [string, string][] }[] = [
  {
    name: "Surfaces et encre",
    tokens: [
      ["--background", "Fond"],
      ["--card", "Carte"],
      ["--muted", "Atténué"],
      ["--foreground", "Encre"],
      ["--muted-foreground", "Encre douce"],
      ["--border", "Filet"],
    ],
  },
  {
    name: "Marque",
    tokens: [
      ["--brand", "Jaune Wema"],
      ["--brand-hover", "Survol"],
      ["--brand-soft", "Jaune doux"],
      ["--brand-text", "Texte jaune"],
      ["--ink-on-brand", "Encre sur jaune"],
    ],
  },
  {
    name: "États",
    tokens: [
      ["--success", "Succès"],
      ["--success-soft", "Succès doux"],
      ["--warning", "Attention"],
      ["--warning-soft", "Attention doux"],
      ["--danger", "Danger"],
      ["--danger-soft", "Danger doux"],
      ["--info", "Info"],
      ["--info-soft", "Info doux"],
    ],
  },
  {
    name: "Pastels (statuts, agenda)",
    tokens: [
      ["--mint", "Menthe"],
      ["--butter", "Beurre"],
      ["--peach", "Pêche"],
      ["--rose", "Rose"],
      ["--lime", "Citron vert"],
      ["--sand", "Sable"],
    ],
  },
];

/** Valeurs calculées des jetons, relues à chaque changement de thème. */
function useTokenValues(names: string[]) {
  const { resolvedTheme } = useTheme();
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!resolvedTheme) return;
    // Après la pose de la classe .dark par next-themes.
    const id = requestAnimationFrame(() => {
      const style = getComputedStyle(document.documentElement);
      setValues(
        Object.fromEntries(
          names.map((n) => [n, style.getPropertyValue(n).trim()]),
        ),
      );
    });
    return () => cancelAnimationFrame(id);
  }, [names, resolvedTheme]);
  return values;
}

const ALL = GROUPS.flatMap((g) => g.tokens.map(([n]) => n));

function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? resolvedTheme : undefined;
  return (
    <fieldset className="inline-flex rounded-lg border bg-muted p-1">
      <legend className="sr-only">Thème</legend>
      {(["light", "dark"] as const).map((t) => (
        <Button
          key={t}
          size="sm"
          variant={current === t ? "default" : "ghost"}
          aria-pressed={current === t}
          onClick={() => setTheme(t)}
        >
          {t === "light" ? "Clair · Crayon" : "Sombre · Nuit"}
        </Button>
      ))}
    </fieldset>
  );
}

const FONTS = [
  {
    name: "Geist",
    role: "Texte, titres, interface",
    className: "font-sans",
    sample: "Un prof particulier pour chaque élève",
  },
  {
    name: "Geist Mono",
    role: "Étiquettes, chiffres, code",
    className: "font-mono uppercase tracking-[0.12em] text-[13px]",
    sample: "Notions validées · 12 / 20",
  },
  {
    name: "Lexend",
    role: "Lecture facile (réglage de l'élève)",
    className: "font-easy",
    sample: "Lis l'énoncé, puis repère ce qu'on te demande.",
  },
  {
    name: "STIX Two",
    role: "Formules mathématiques",
    className: "font-math italic",
    sample: "f(x) = 3x² − 5x + 2,  x ∈ ℝ",
  },
];

const SCALE = [
  { label: "Titre de page · 34 / léger", className: "text-[34px] font-light" },
  { label: "Titre de section · 24 / léger", className: "text-2xl font-light" },
  {
    label: "Titre de carte · 16 / demi-gras",
    className: "text-base font-semibold",
  },
  { label: "Texte · 15", className: "text-[15px]" },
  {
    label: "Aide · 13 / encre douce",
    className: "text-[13px] text-muted-foreground",
  },
];

const RADII = [
  ["chip", "6 px", "rounded-chip"],
  ["contrôle", "8 px", "rounded-control"],
  ["menu", "10 px", "rounded-menu"],
  ["carte", "12 px", "rounded-card"],
  ["dialogue", "14 px", "rounded-dialog"],
  ["pilule", "∞", "rounded-pill"],
] as const;

const SHADOWS = [
  ["xs", "Champs, tuiles", "shadow-xs"],
  ["sm", "Cartes", "shadow-sm"],
  ["md", "Menus, survol", "shadow-md"],
  ["lg", "Dialogues", "shadow-lg"],
] as const;

const MOTION = [
  ["arrive", "Entrée : rapide puis douce", "var(--ease-arrive)", 320],
  ["return", "Retour au repos", "var(--ease-return)", 320],
  ["sweep", "Balayage (boutons biseautés)", "var(--ease-sweep)", 500],
] as const;

function MotionDemo() {
  const [on, setOn] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      {MOTION.map(([name, role, ease, ms]) => (
        <div key={name} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">
              {name}{" "}
              <span className="font-normal text-muted-foreground">
                · {role}
              </span>
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {ms} ms
            </span>
          </div>
          <div className="relative h-8 rounded-pill bg-muted">
            <span
              className={cn(
                "absolute top-1 left-1 size-6 rounded-pill bg-brand shadow-sm motion-reduce:transition-none",
                on && "left-[calc(100%-1.75rem)]",
              )}
              style={{
                transitionProperty: "left",
                transitionTimingFunction: ease,
                transitionDuration: `${ms}ms`,
              }}
            />
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setOn((v) => !v)}
      >
        Rejouer les courbes
      </Button>
    </div>
  );
}

export function Foundations({ id, index, title }: SectionProps) {
  const values = useTokenValues(ALL);
  return (
    <Section
      id={id}
      index={index}
      title={title}
      when="Toujours : on ne code jamais une couleur, un rayon ou une durée en dur. On passe par ces jetons, qui changent seuls avec le thème."
    >
      <Specimen
        label="Couleurs et jetons"
        note={<ThemeSwitch />}
        className="flex flex-col gap-8"
      >
        {GROUPS.map((g) => (
          <div key={g.name} className="flex flex-col gap-3">
            <p className="text-sm font-medium">{g.name}</p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {g.tokens.map(([name, label]) => (
                <li key={name} className="flex min-w-0 flex-col gap-2">
                  <span
                    aria-hidden
                    className="h-14 rounded-control border shadow-xs"
                    style={{ background: `var(${name})` }}
                  />
                  <span className="truncate text-sm">{label}</span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {name} · {values[name] ?? "…"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Specimen>

      <Specimen
        label="Typographie"
        className="flex flex-col divide-y p-0 sm:p-0"
      >
        {FONTS.map((f) => (
          <div
            key={f.name}
            className="grid gap-2 p-4 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-6 sm:p-6"
          >
            <div>
              <p className="text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">{f.role}</p>
            </div>
            <p className={cn("text-xl break-words sm:text-2xl", f.className)}>
              {f.sample}
            </p>
          </div>
        ))}
        <div className="flex flex-col gap-3 p-4 sm:p-6">
          {SCALE.map((s) => (
            <p key={s.label} className={cn("tracking-tight", s.className)}>
              {s.label}
            </p>
          ))}
        </div>
      </Specimen>

      <div className="grid gap-8 xl:grid-cols-3">
        <Specimen label="Arrondis">
          <ul className="grid grid-cols-3 gap-4">
            {RADII.map(([name, size, cls]) => (
              <li key={name} className="flex flex-col items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "size-14 border-2 border-foreground/70 bg-brand-soft",
                    cls,
                  )}
                />
                <span className="text-xs">{name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {size}
                </span>
              </li>
            ))}
          </ul>
        </Specimen>
        <Specimen label="Ombres" className="bg-background">
          <ul className="grid grid-cols-2 gap-4">
            {SHADOWS.map(([name, role, cls]) => (
              <li
                key={name}
                className={cn(
                  "flex flex-col gap-1 rounded-card bg-card p-3",
                  cls,
                )}
              >
                <span className="font-mono text-[11px]">shadow-{name}</span>
                <span className="text-xs text-muted-foreground">{role}</span>
              </li>
            ))}
          </ul>
        </Specimen>
        <Specimen label="Mouvement">
          <MotionDemo />
        </Specimen>
      </div>
    </Section>
  );
}
