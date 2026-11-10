"use client";

import {
  ILLUSTRATION_FOR,
  Illustration,
  type IllustrationUsage,
} from "@wema/ui/components/illustrations/illustration";
import { Section } from "../_components/section";
import type { SectionProps } from "../_components/showcase";

const GROUPS: { name: string; items: [IllustrationUsage, string, string][] }[] =
  [
    {
      name: "États vides",
      items: [
        [
          "emptyHomework",
          "Aucun devoir",
          "Un classeur : le tiroir s'ouvre sur du vide.",
        ],
        [
          "emptyMessages",
          "Aucun message",
          "Un routeur dont les antennes cherchent le signal.",
        ],
        ["emptyClasses", "Aucune classe", "Une rangée de casiers d'école."],
        ["emptyExercises", "Aucun exercice", "Un panier qui montre son fond."],
      ],
    },
    {
      name: "Onboarding",
      items: [
        ["welcome", "Bienvenue", "Un ordinateur dont l'écran s'ouvre."],
        [
          "levelTest",
          "Test de niveau",
          "Un ascenseur : il monte à l'étage pointé.",
        ],
        ["diagnostic", "Diagnostic", "Une loupe qui parcourt la feuille."],
      ],
    },
    {
      name: "États du système",
      items: [
        [
          "loading",
          "Chargement",
          "Des caisses sur un tapis roulant, en continu.",
        ],
        ["error", "Erreur", "Une prise qui n'atteint pas tout à fait le mur."],
        [
          "notFound",
          "Page introuvable",
          "Un point d'interrogation qui suit le pointeur.",
        ],
        ["success", "Réussite", "Des piliers qui s'élèvent."],
      ],
    },
  ];

export function Illustrations({ id, index, title }: SectionProps) {
  return (
    <Section
      id={id}
      index={index}
      title={title}
      when="Une figure Hairline accompagne un moment sans contenu ou un moment clé (vide, bienvenue, erreur), jamais un écran de travail. Elle est décorative : le texte à côté dit tout. Elle répond au pointeur et devient une image fixe si l'on réduit les animations."
    >
      {GROUPS.map((g) => (
        <div key={g.name} className="flex flex-col gap-3">
          <h3 className="font-mono text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {g.name}
          </h3>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {g.items.map(([usage, label, what]) => (
              <li
                key={usage}
                className="flex flex-col overflow-hidden rounded-card border bg-card shadow-xs"
              >
                <Illustration
                  figure={ILLUSTRATION_FOR[usage]}
                  play={usage === "loading"}
                  className="mx-auto w-full max-w-[280px]"
                />
                <div className="flex flex-col gap-1 border-t px-3 py-3 sm:px-4">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm font-medium">
                    {label}
                    <code className="font-mono text-[11px] font-normal text-muted-foreground">
                      {ILLUSTRATION_FOR[usage]}
                    </code>
                  </p>
                  <p className="text-xs text-muted-foreground">{what}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}
