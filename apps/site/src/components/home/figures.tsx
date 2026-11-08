import {
  Bell,
  Camera,
  CheckCircle,
  Circle,
  Seal,
  Sparkle,
} from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { cx, Mono } from "../kit";

/** Cadre commun d'une figure : en-tête (titre, état) et fond pointillé. */
export function Figure({
  label,
  status,
  statusTone = "brand",
  children,
}: {
  label: string;
  status: string;
  statusTone?: "brand" | "mint" | "rose";
  children: ReactNode;
}) {
  const dot = {
    brand: "bg-brand",
    mint: "bg-mint-ink",
    rose: "bg-rose-ink",
  } as const;
  return (
    <figure className="flex h-full flex-col border border-line bg-paper">
      <figcaption className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <Mono className="truncate text-ink-muted uppercase">{label}</Mono>
        <Mono className="flex shrink-0 items-center gap-1.5 uppercase">
          <span
            aria-hidden="true"
            className={cx("size-1.5 rounded-full", dot[statusTone])}
          />
          {status}
        </Mono>
      </figcaption>
      <div className="figure-dots flex-1 p-4 sm:p-5">{children}</div>
    </figure>
  );
}

/** Étape 1 : le profil, chaque affirmation avec sa confiance et sa preuve. */
export function ProfileFigure() {
  const rows = [
    {
      claim: "Maîtrise les priorités de calcul",
      proof: "8 exercices réussis sur 9",
      confidence: 88,
    },
    {
      claim: "Confond périmètre et aire",
      proof: "3 erreurs du même type",
      confidence: 71,
    },
    {
      claim: "Réussit mieux avec un schéma",
      proof: "Taux de réussite +24 %",
      confidence: 64,
    },
  ];
  return (
    <Figure
      label="Fig. 02 · Profil d'Inès, 4e"
      status="Mis à jour"
      statusTone="mint"
    >
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li
            key={row.claim}
            className="grid grid-cols-[1fr_auto] items-center gap-3 border border-line bg-surface px-3.5 py-3"
          >
            <span>
              <span className="block text-[14px] font-semibold">
                {row.claim}
              </span>
              <Mono className="text-ink-muted">Preuve : {row.proof}</Mono>
            </span>
            <span className="w-24 text-right">
              <Mono className="block text-ink">{row.confidence} %</Mono>
              <span className="mt-1 block h-1 bg-line" aria-hidden="true">
                <span
                  className="block h-full bg-brand"
                  style={{ width: `${row.confidence}%` }}
                />
              </span>
            </span>
          </li>
        ))}
      </ul>
      <Mono className="mt-3 block text-ink-muted">
        Confiance calculée à partir de ses réponses, jamais affirmée sans trace.
      </Mono>
    </Figure>
  );
}

/** Étape 2 : un même exercice, trois façons de le présenter. */
export function VariantsFigure() {
  const variants = [
    {
      name: "Standard",
      text: "Un rectangle mesure 7 cm sur 4 cm. Calcule son aire.",
      tone: "bg-surface",
    },
    {
      name: "Lecture facile",
      text: "Un rectangle. Longueur : 7 cm. Largeur : 4 cm. Quelle est son aire ?",
      tone: "bg-surface font-easy tracking-wide",
    },
    {
      name: "En contexte",
      text: "Le jardin de Kofi fait 7 m sur 4 m. Combien de m² de gazon faut-il ?",
      tone: "bg-surface",
    },
  ];
  return (
    <Figure
      label="Fig. 03 · Une notion, trois variantes"
      status="Vérifié"
      statusTone="mint"
    >
      <ul className="space-y-2.5">
        {variants.map((v, i) => (
          <li
            key={v.name}
            className={cx(
              "grid grid-cols-[auto_1fr_auto] items-start gap-3 border border-line px-3.5 py-3",
              i === 1 && "border-brand shadow-[0_0_0_3px_rgb(255_197_41/0.25)]",
              v.tone,
            )}
          >
            <Mono className="mt-0.5 grid size-6 place-items-center border border-line bg-paper">
              {i + 1}
            </Mono>
            <span>
              <Mono className="block text-ink-muted uppercase">{v.name}</Mono>
              <span className="mt-1 block text-[14px] leading-snug">
                {v.text}
              </span>
            </span>
            <CheckCircle
              size={18}
              weight="fill"
              className="mt-0.5 text-mint-ink"
              aria-label="Vérifié"
            />
          </li>
        ))}
      </ul>
      <Mono className="mt-3 block text-ink-muted">
        Même notion évaluée. Chaque variante passe par le moteur de calcul avant
        d'être proposée.
      </Mono>
    </Figure>
  );
}

/** Étape 3 : la copie photographiée, les erreurs repérées. */
export function CopyFigure() {
  return (
    <Figure
      label="Fig. 04 · Contrôle du 14 novembre"
      status="Relu"
      statusTone="brand"
    >
      <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
        <div className="relative flex aspect-[3/4] flex-col gap-2 border border-line bg-surface p-3">
          <Camera size={16} className="text-ink-muted" aria-hidden="true" />
          {[80, 64, 90, 55, 72, 60].map((w, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: lignes décoratives fixes
              key={i}
              aria-hidden="true"
              className={cx(
                "h-1.5 rounded-full",
                i === 2 || i === 4 ? "bg-rose" : "bg-line",
              )}
              style={{ width: `${w}%` }}
            />
          ))}
          <span className="mt-auto self-end rounded-sm bg-rose px-1.5 py-0.5 font-mono text-[10px] text-rose-ink">
            11/20
          </span>
        </div>
        <ul className="space-y-2">
          {[
            {
              line: "Ligne 3",
              what: "Aire calculée comme un périmètre",
              notion: "Aire du rectangle",
            },
            {
              line: "Ligne 5",
              what: "Unité oubliée (cm²)",
              notion: "Unités d'aire",
            },
          ].map((e) => (
            <li
              key={e.line}
              className="border border-line bg-surface px-3 py-2.5"
            >
              <Mono className="text-rose-ink uppercase">{e.line}</Mono>
              <span className="block text-[14px] font-semibold">{e.what}</span>
              <span className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-muted">
                <Sparkle
                  size={13}
                  weight="fill"
                  className="text-brand-ink"
                  aria-hidden="true"
                />
                À retravailler : {e.notion}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Figure>
  );
}

/** Étape 4 : la semaine, avec relances et révisions espacées. */
export function WeekFigure() {
  const days = [
    { day: "Lun", what: "Devoir du prof", done: true, kind: "task" },
    { day: "Mar", what: "Exercice adapté", done: true, kind: "task" },
    {
      day: "Mer",
      what: "Relance : « Tu as fini ? »",
      done: true,
      kind: "nudge",
    },
    {
      day: "Ven",
      what: "Révision : aire, vue il y a 5 jours",
      done: false,
      kind: "review",
    },
    {
      day: "Dim",
      what: "Résumé de la semaine pour le parent",
      done: false,
      kind: "report",
    },
  ] as const;
  return (
    <Figure label="Fig. 05 · Semaine 46" status="En cours">
      <ol className="relative space-y-2 before:absolute before:top-3 before:bottom-3 before:left-[46px] before:w-px before:bg-line-strong">
        {days.map((d) => (
          <li
            key={d.day}
            className="relative grid grid-cols-[34px_24px_1fr] items-center gap-3"
          >
            <Mono className="text-ink-muted uppercase">{d.day}</Mono>
            <span className="relative z-10 grid place-items-center bg-paper">
              {d.done ? (
                <CheckCircle
                  size={20}
                  weight="fill"
                  className="text-mint-ink"
                  aria-label="Fait"
                />
              ) : (
                <Circle
                  size={20}
                  className="text-line-strong"
                  aria-label="À venir"
                />
              )}
            </span>
            <span
              className={cx(
                "flex items-center gap-2 border px-3 py-2 text-[14px]",
                d.kind === "nudge" && "border-brand bg-brand-soft",
                d.kind === "review" && "border-line bg-surface",
                d.kind === "task" && "border-line bg-surface",
                d.kind === "report" && "border-line bg-surface",
              )}
            >
              {d.kind === "nudge" ? (
                <Bell
                  size={14}
                  weight="fill"
                  className="text-brand-ink"
                  aria-hidden="true"
                />
              ) : d.kind === "report" ? (
                <Seal
                  size={14}
                  weight="fill"
                  className="text-brand-ink"
                  aria-hidden="true"
                />
              ) : null}
              {d.what}
            </span>
          </li>
        ))}
      </ol>
    </Figure>
  );
}
