"use client";

import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import type {
  ComicsCharacter,
  ComicsContent,
  ComicsPanel,
} from "../../lib/formats-types";
import { MathText } from "../learner/math";

// Format « bande dessinée » : cases dessinées en SVG (décor et personnages
// simples, aux couleurs de la charte), bulles en vrai texte HTML. Le contenu
// vient de l'IA, contrôlé par le cœur (mêmes nombres, mêmes formules).

const FILL: Record<ComicsCharacter["color"], string> = {
  butter: "fill-butter",
  peach: "fill-peach",
  mint: "fill-mint",
  rose: "fill-rose",
  lime: "fill-lime",
  sand: "fill-sand",
};

const SIZE: Record<ComicsCharacter["look"], { head: number; body: number }> = {
  round: { head: 15, body: 34 },
  tall: { head: 12, body: 46 },
  small: { head: 11, body: 26 },
};

/** Personnage simple : tête, corps, yeux et sourire. */
function Character({ c, x }: { c: ComicsCharacter; x: number }) {
  const { head, body } = SIZE[c.look];
  const ground = 108;
  const top = ground - body;
  return (
    <g>
      <path
        d={`M ${x - 16} ${ground} Q ${x - 16} ${top} ${x} ${top} Q ${x + 16} ${top} ${x + 16} ${ground} Z`}
        className={cn(FILL[c.color], "stroke-foreground")}
        strokeWidth={1.5}
      />
      <circle
        cx={x}
        cy={top - head + 2}
        r={head}
        className="fill-card stroke-foreground"
        strokeWidth={1.5}
      />
      <circle
        cx={x - head / 3}
        cy={top - head}
        r={1.6}
        className="fill-foreground"
      />
      <circle
        cx={x + head / 3}
        cy={top - head}
        r={1.6}
        className="fill-foreground"
      />
      <path
        d={`M ${x - head / 3} ${top - head / 2 + 2} Q ${x} ${top - head / 4 + 4} ${x + head / 3} ${top - head / 2 + 2}`}
        fill="none"
        className="stroke-foreground"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Décor stylisé selon le lieu (le détail est dans la description écrite). */
function Place({ place }: { place: ComicsPanel["place"] }) {
  const line = "stroke-border";
  switch (place) {
    case "outdoor":
    case "field":
      return (
        <>
          <circle cx={170} cy={22} r={10} className="fill-brand-soft" />
          <path
            d="M 0 96 Q 50 86 100 96 T 200 96 L 200 120 L 0 120 Z"
            className={place === "field" ? "fill-lime" : "fill-mint"}
            opacity={0.6}
          />
        </>
      );
    case "school":
      return (
        <rect
          x={60}
          y={14}
          width={80}
          height={40}
          rx={3}
          className="fill-surface-sunk stroke-border"
        />
      );
    case "shop":
      return (
        <>
          <rect
            x={10}
            y={70}
            width={180}
            height={18}
            className="fill-sand stroke-border"
          />
          <line x1={10} x2={190} y1={30} y2={30} className={line} />
        </>
      );
    case "kitchen":
      return (
        <>
          <rect
            x={130}
            y={60}
            width={60}
            height={48}
            rx={3}
            className="fill-surface-sunk stroke-border"
          />
          <circle cx={150} cy={66} r={4} className="fill-peach" />
          <circle cx={170} cy={66} r={4} className="fill-peach" />
        </>
      );
    case "indoor":
      return (
        <rect
          x={140}
          y={16}
          width={40}
          height={34}
          rx={2}
          className="fill-surface-sunk stroke-border"
        />
      );
    case "none":
      return null;
  }
}

function Panel({
  panel,
  index,
  characters,
  rendered,
}: {
  panel: ComicsPanel;
  index: number;
  characters: ComicsContent["characters"];
  rendered: Record<string, { text: string; latex: string }>;
}) {
  const t = useTranslations("formats.comics");
  const speaking = characters.filter((c) =>
    panel.bubbles.some((b) => b.speaker === c.id),
  );
  const shown = speaking.length > 0 ? speaking : characters;
  const spacing = 200 / (shown.length + 1);
  return (
    <li className="flex flex-col overflow-hidden rounded-xl border-2 border-foreground/80 bg-card">
      <figure className="m-0 flex flex-1 flex-col">
        {panel.caption && (
          <p className="border-b-2 border-foreground/80 bg-muted px-3 py-2 text-sm font-medium">
            <MathText text={panel.caption} rendered={rendered} />
          </p>
        )}
        <svg
          viewBox="0 0 200 120"
          aria-hidden="true"
          className="w-full bg-background"
        >
          <line x1={0} x2={200} y1={108} y2={108} className="stroke-border" />
          <Place place={panel.place} />
          {shown.map((c, i) => (
            <Character key={c.id} c={c} x={spacing * (i + 1)} />
          ))}
        </svg>
        <figcaption className="sr-only">
          {t("panel", { index: index + 1 })} {panel.setting}
        </figcaption>
        <p
          aria-hidden="true"
          className="px-3 pt-2 text-xs italic text-muted-foreground"
        >
          {panel.setting}
        </p>
        <div className="space-y-2 p-3">
          {panel.bubbles.map((b, i) => {
            const who = characters.find((c) => c.id === b.speaker);
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: bulles d'une case, ordre fixe
                key={i}
                className={cn(
                  "relative rounded-2xl border-2 border-foreground/80 bg-card px-3 py-2",
                  b.kind === "thought" && "border-dashed",
                )}
              >
                <span className="block text-xs font-semibold text-muted-foreground">
                  {b.kind === "thought"
                    ? t("thinks", { name: who?.name ?? "" })
                    : t("says", { name: who?.name ?? "" })}
                </span>
                <span className="text-base">
                  <MathText text={b.text} rendered={rendered} />
                </span>
              </div>
            );
          })}
        </div>
      </figure>
    </li>
  );
}

/** Bande dessinée d'un énoncé : 3 à 5 cases, lisibles dans l'ordre. */
export function Comics({
  comics,
  rendered,
}: {
  comics: ComicsContent;
  rendered: Record<string, { text: string; latex: string }>;
}) {
  return (
    <section aria-label={comics.title} className="space-y-3">
      <h2 className="font-display text-xl font-bold">{comics.title}</h2>
      <ol className="grid list-none gap-3 p-0 sm:grid-cols-2">
        {comics.panels.map((panel, i) => (
          <Panel
            // biome-ignore lint/suspicious/noArrayIndexKey: cases d'une BD, ordre fixe
            key={i}
            panel={panel}
            index={i}
            characters={comics.characters}
            rendered={rendered}
          />
        ))}
      </ol>
    </section>
  );
}
