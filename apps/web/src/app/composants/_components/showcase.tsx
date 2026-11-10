"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { TsfDiamond, TsfTitle } from "@wema/ui/brand";
import { Button } from "@wema/ui/components/ui/button";
import { cn } from "@wema/ui/lib/utils";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Badges } from "../_sections/badges";
import { Buttons } from "../_sections/buttons";
import { CalendarSection } from "../_sections/calendar";
import { Cards } from "../_sections/cards";
import { Charts } from "../_sections/charts";
import { DataSection } from "../_sections/data";
import { Feedback } from "../_sections/feedback";
import { Forms } from "../_sections/forms";
import { Foundations } from "../_sections/foundations";
import { Icons } from "../_sections/icons";
import { Illustrations } from "../_sections/illustrations";
import { Navigation } from "../_sections/navigation";
import { People } from "../_sections/people";
import { Tutor } from "../_sections/tutor";

export interface SectionProps {
  id: string;
  index: number;
  title: string;
}

const SECTIONS: {
  id: string;
  title: string;
  Body: (props: SectionProps) => ReactNode;
}[] = [
  { id: "fondations", title: "Fondations", Body: Foundations },
  { id: "boutons", title: "Boutons", Body: Buttons },
  { id: "badges", title: "Badges", Body: Badges },
  { id: "cartes", title: "Cartes", Body: Cards },
  { id: "formulaires", title: "Formulaires", Body: Forms },
  { id: "navigation", title: "Navigation", Body: Navigation },
  { id: "personnes", title: "Personnes", Body: People },
  { id: "donnees", title: "Données", Body: DataSection },
  { id: "graphiques", title: "Graphiques", Body: Charts },
  { id: "calendrier", title: "Calendrier", Body: CalendarSection },
  { id: "prof-ia", title: "Prof IA", Body: Tutor },
  { id: "retours", title: "Retours", Body: Feedback },
  { id: "illustrations", title: "Illustrations", Body: Illustrations },
  { id: "icones", title: "Icônes", Body: Icons },
];

/** Bascule clair / sombre (thème « Crayon » ou « Nuit »). */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-pressed={dark}
    >
      {dark ? <Moon weight="bold" /> : <Sun weight="bold" />}
      Thème sombre
    </Button>
  );
}

/** Section visible, pour surligner son entrée dans le sommaire. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        // En haut de page, avant la première section : la première.
        const first =
          ids.find((id) => seen.get(id)) ??
          (window.scrollY < 300 ? ids[0] : undefined);
        if (first) setActive(first);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    for (const id of ids) {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

const IDS = SECTIONS.map((s) => s.id);

export function Showcase() {
  const active = useActiveSection(IDS);
  // Sur mobile, le sommaire défile à l'horizontale : il suit la section lue.
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const box = nav.current;
    const link = box?.querySelector<HTMLElement>(`a[href="#${active}"]`);
    if (box && link && box.scrollWidth > box.clientWidth)
      box.scrollTo({ left: link.offsetLeft - 16, behavior: "smooth" });
  }, [active]);
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6">
          <a
            href="#fondations"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <TsfDiamond />
            Wema
            <span className="font-mono text-[11px] font-normal tracking-[0.12em] text-muted-foreground uppercase">
              Composants
            </span>
          </a>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14 lg:py-14">
        <nav
          ref={nav}
          aria-label="Sommaire"
          className="sticky top-14 z-20 max-lg:-mx-4 max-lg:overflow-x-auto max-lg:border-b max-lg:bg-background/90 max-lg:px-4 max-lg:py-2 max-lg:backdrop-blur sm:max-lg:-mx-6 sm:max-lg:px-6 lg:top-24 lg:self-start"
        >
          <ol className="flex gap-1 lg:flex-col">
            {SECTIONS.map((s, i) => (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  aria-current={active === s.id ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    "aria-[current]:bg-accent aria-[current]:font-medium aria-[current]:text-foreground",
                  )}
                >
                  <span className="font-mono text-[11px] tabular-nums opacity-70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main className="flex min-w-0 flex-col gap-16">
          <div className="flex max-w-3xl flex-col gap-4">
            <TsfTitle
              as="h1"
              lines={["La boîte à outils de Wema"]}
              className="text-[34px] leading-[1.05] sm:text-[48px]"
            />
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              Les vrais composants de{" "}
              <code className="font-mono">@wema/ui</code>, en direct et
              interactifs. Toutes les données sont fictives. Chaque section dit
              quand se servir de ce qu'elle montre.
            </p>
          </div>
          {SECTIONS.map(({ id, title, Body }, i) => (
            <Body key={id} id={id} index={i + 1} title={title} />
          ))}
        </main>
      </div>
    </div>
  );
}
