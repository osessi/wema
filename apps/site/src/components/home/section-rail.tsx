"use client";

import { useEffect, useState } from "react";

export const CHAPTERS = [
  { id: "accueil", label: "Accueil" },
  { id: "matieres", label: "Matières" },
  { id: "methode", label: "Méthode" },
  { id: "parents", label: "Parents" },
  { id: "profs", label: "Profs et écoles" },
  { id: "offre", label: "Offre" },
  { id: "questions", label: "Questions" },
] as const;

/** Sommaire fixe à gauche (grands écrans) : le chapitre lu est mis en avant. */
export function SectionRail() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const middle = window.innerHeight / 2;
      let current = 0;
      CHAPTERS.forEach((chapter, index) => {
        const el = document.getElementById(chapter.id);
        if (el && el.getBoundingClientRect().top <= middle) current = index;
      });
      setActive(current);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <nav
      aria-label="Chapitres de la page"
      className="fixed top-1/2 left-4 z-40 hidden -translate-y-1/2 2xl:block"
    >
      <ol className="space-y-2.5">
        {CHAPTERS.map((chapter, index) => (
          <li key={chapter.id}>
            <a
              href={`#${chapter.id}`}
              aria-current={index === active}
              className="rail-item"
            >
              <span className="font-mono text-[10.5px] opacity-70">
                {String(index + 1).padStart(2, "0")}
              </span>
              {chapter.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
