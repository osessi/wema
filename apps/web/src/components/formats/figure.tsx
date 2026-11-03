"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useId } from "react";
import type { FigureSpec } from "../../lib/formats-types";
import { numberLineTicks, squareOn, triangleLayout } from "./geometry";

// Format « schéma » : figures dessinées en SVG à partir des paramètres de la
// variante (gabarits choisis par le cœur, @wema/exercises figureFor). Le texte
// des figures est du vrai texte ; la grandeur cherchée est toujours « ? ».

const STROKE = "stroke-foreground";

/** Plateau de balance : boîtes « inconnue » et poids connu. */
export function BalancePlate({
  x,
  y,
  coefficient,
  constant,
  variable,
}: {
  x: number;
  y: number;
  coefficient: number;
  constant: number;
  variable: string;
}) {
  const boxes = Math.min(coefficient, 6);
  const many = coefficient > 6;
  const width = 18;
  const items: ReactNode[] = [];
  let cursor =
    x - ((many ? 1 : boxes) * (width + 3) + (constant > 0 ? 34 : 0)) / 2;
  if (many) {
    items.push(
      <g key="many">
        <rect
          x={cursor}
          y={y - 24}
          width={30}
          height={22}
          rx={3}
          className={`fill-butter ${STROKE}`}
        />
        <text
          x={cursor + 15}
          y={y - 9}
          textAnchor="middle"
          className="fill-foreground text-[11px] font-semibold"
        >
          {`${coefficient}${variable}`}
        </text>
      </g>,
    );
    cursor += 34;
  } else {
    for (let i = 0; i < boxes; i++) {
      items.push(
        <g key={`box-${i}`}>
          <rect
            x={cursor}
            y={y - 22}
            width={width}
            height={20}
            rx={3}
            className={`fill-butter ${STROKE}`}
          />
          <text
            x={cursor + width / 2}
            y={y - 8}
            textAnchor="middle"
            className="fill-foreground text-[11px] font-semibold"
          >
            {variable}
          </text>
        </g>,
      );
      cursor += width + 3;
    }
  }
  if (constant > 0) {
    items.push(
      <g key="weight">
        <path
          d={`M ${cursor + 4} ${y - 2} L ${cursor + 28} ${y - 2} L ${cursor + 24} ${y - 22} L ${cursor + 8} ${y - 22} Z`}
          className={`fill-sand ${STROKE}`}
        />
        <text
          x={cursor + 16}
          y={y - 8}
          textAnchor="middle"
          className="fill-foreground text-[11px] font-semibold"
        >
          {constant}
        </text>
      </g>,
    );
  }
  return (
    <g>
      <line
        x1={x - 60}
        x2={x + 60}
        y1={y}
        y2={y}
        strokeWidth={3}
        strokeLinecap="round"
        className={STROKE}
      />
      {items}
    </g>
  );
}

/** Balance à l'équilibre : les deux membres de l'équation. */
export function BalanceDrawing({
  left,
  right,
  variable,
}: {
  left: { coefficient: number; constant: number };
  right: { coefficient: number; constant: number };
  variable: string;
}) {
  return (
    <>
      <path
        d="M 160 150 L 145 172 L 175 172 Z"
        className={`fill-muted ${STROKE}`}
      />
      <line
        x1={160}
        x2={160}
        y1={60}
        y2={150}
        strokeWidth={3}
        className={STROKE}
      />
      <line
        x1={60}
        x2={260}
        y1={60}
        y2={60}
        strokeWidth={4}
        strokeLinecap="round"
        className={STROKE}
      />
      <line x1={70} x2={70} y1={60} y2={120} className={STROKE} />
      <line x1={250} x2={250} y1={60} y2={120} className={STROKE} />
      <BalancePlate x={70} y={120} variable={variable} {...left} />
      <BalancePlate x={250} y={120} variable={variable} {...right} />
    </>
  );
}

function Svg({
  title,
  description,
  viewBox,
  children,
}: {
  title: string;
  description: string;
  viewBox: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-labelledby={`${id}-t ${id}-d`}
      className="h-auto w-full max-w-md text-foreground"
    >
      <title id={`${id}-t`}>{title}</title>
      <desc id={`${id}-d`}>{description}</desc>
      {children}
    </svg>
  );
}

/** Triangle rectangle coté, avec les carrés construits sur ses côtés en option. */
export function RightTriangleDrawing({
  legs,
  hypotenuse,
  squares = [],
}: {
  legs: readonly [number | null, number | null];
  hypotenuse: number | null;
  /** Côtés dont le carré est dessiné : "ab", "ac", "bc". */
  squares?: readonly ("ab" | "ac" | "bc")[];
}) {
  const { a, b, c } = triangleLayout(legs, hypotenuse, 120);
  const label = (n: number | null) => (n === null ? "?" : String(n));
  const poly = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x},${p.y}`).join(" ");
  const fills = { ab: "fill-mint", ac: "fill-peach", bc: "fill-butter" };
  const sides = { ab: [a, b], ac: [c, a], bc: [b, c] } as const;
  return (
    <>
      {squares.map((s) => {
        const [p, q] = sides[s];
        return (
          <polygon
            key={s}
            points={poly(squareOn(p, q))}
            className={`${fills[s]} stroke-border opacity-80`}
          />
        );
      })}
      <polygon
        points={poly([a, b, c])}
        strokeWidth={2.5}
        strokeLinejoin="round"
        className={`fill-card ${STROKE}`}
      />
      <polyline
        points={poly([
          { x: a.x, y: a.y - 12 },
          { x: a.x + 12, y: a.y - 12 },
          { x: a.x + 12, y: a.y },
        ])}
        fill="none"
        className={STROKE}
      />
      <text
        x={a.x - 14}
        y={a.y + 14}
        className="fill-foreground text-[13px] font-semibold"
      >
        A
      </text>
      <text
        x={b.x - 14}
        y={b.y + 4}
        className="fill-foreground text-[13px] font-semibold"
      >
        B
      </text>
      <text
        x={c.x + 6}
        y={c.y + 14}
        className="fill-foreground text-[13px] font-semibold"
      >
        C
      </text>
      <text
        x={a.x + 6}
        y={(a.y + b.y) / 2}
        className="fill-foreground text-[13px] font-semibold"
      >
        {label(legs[0])}
      </text>
      <text
        x={(a.x + c.x) / 2}
        y={a.y - 6}
        textAnchor="middle"
        className="fill-foreground text-[13px] font-semibold"
      >
        {label(legs[1])}
      </text>
      <text
        x={(b.x + c.x) / 2 + 8}
        y={(b.y + c.y) / 2 - 6}
        className="fill-foreground text-[13px] font-semibold"
      >
        {label(hypotenuse)}
      </text>
    </>
  );
}

/** Figure d'une variante, avec son titre et sa description pour les lecteurs d'écran. */
export function Figure({ figure }: { figure: FigureSpec }) {
  const t = useTranslations("formats.figure");
  switch (figure.kind) {
    case "balance":
      return (
        <Svg
          viewBox="0 0 320 180"
          title={t("balance.title")}
          description={t("balance.description", {
            left: side(figure.left, figure.variable),
            right: side(figure.right, figure.variable),
          })}
        >
          <BalanceDrawing {...figure} />
        </Svg>
      );
    case "right_triangle": {
      const unknown = (n: number | null) => (n === null ? "?" : String(n));
      return (
        <Svg
          viewBox="-30 -20 200 170"
          title={t("triangle.title")}
          description={t("triangle.description", {
            ab: unknown(figure.legs[0]),
            ac: unknown(figure.legs[1]),
            bc: unknown(figure.hypotenuse),
          })}
        >
          <RightTriangleDrawing
            legs={figure.legs}
            hypotenuse={figure.hypotenuse}
          />
        </Svg>
      );
    }
    case "number_line":
      return <NumberLine start={figure.start} step={figure.step} />;
    case "square":
      return (
        <Svg
          viewBox="-20 -20 180 170"
          title={t("square.title")}
          description={t("square.description", { side: figure.side })}
        >
          <rect
            x={10}
            y={10}
            width={120}
            height={120}
            strokeWidth={2.5}
            className={`fill-butter ${STROKE}`}
          />
          <text
            x={70}
            y={2}
            textAnchor="middle"
            className="fill-foreground text-[13px] font-semibold"
          >
            {figure.side}
          </text>
          <text
            x={-4}
            y={74}
            textAnchor="end"
            className="fill-foreground text-[13px] font-semibold"
          >
            {figure.side}
          </text>
          <text
            x={70}
            y={76}
            textAnchor="middle"
            className="fill-foreground text-base font-bold"
          >
            {t("square.area")}
          </text>
        </Svg>
      );
  }
}

function side(s: { coefficient: number; constant: number }, variable: string) {
  const parts: string[] = [];
  if (s.coefficient > 0)
    parts.push(s.coefficient === 1 ? variable : `${s.coefficient}${variable}`);
  if (s.constant > 0 || parts.length === 0) parts.push(String(s.constant));
  return parts.join(" + ");
}

function NumberLine({ start, step }: { start: number; step: number }) {
  const t = useTranslations("formats.figure");
  const { min, max, ticks, every } = numberLineTicks(start, step);
  const width = 300;
  const x = (v: number) => 10 + ((v - min) / (max - min)) * width;
  const end = start + step;
  const arc = `M ${x(start)} 60 Q ${(x(start) + x(end)) / 2} ${10} ${x(end)} 60`;
  return (
    <Svg
      viewBox="0 0 320 100"
      title={t("numberLine.title")}
      description={t("numberLine.description", { start, step })}
    >
      <line
        x1={5}
        x2={315}
        y1={70}
        y2={70}
        strokeWidth={2}
        className={STROKE}
      />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={64} y2={76} className={STROKE} />
          {/* L'arrivée n'est pas graduée : c'est elle qu'on cherche. */}
          {v !== end && (every > 1 || ticks.length <= 12 || v % 5 === 0) && (
            <text
              x={x(v)}
              y={92}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {v}
            </text>
          )}
        </g>
      ))}
      <path
        d={arc}
        fill="none"
        strokeWidth={2}
        strokeDasharray="4 3"
        className={STROKE}
      />
      <circle cx={x(start)} cy={70} r={5} className="fill-primary" />
      <circle cx={x(end)} cy={70} r={5} className={`fill-card ${STROKE}`} />
      <text
        x={(x(start) + x(end)) / 2}
        y={28}
        textAnchor="middle"
        className="fill-foreground text-[12px] font-semibold"
      >
        {step > 0 ? `+${step}` : String(step)}
      </text>
      <text
        x={x(end)}
        y={56}
        textAnchor="middle"
        className="fill-foreground text-[12px] font-bold"
      >
        ?
      </text>
    </Svg>
  );
}
