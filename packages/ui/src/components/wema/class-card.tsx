import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { GlowTile, type GlowTone } from "../brand/glow-tile";
import { CARD_INNER_SHADOW, CardShell, type CardTone } from "../ui/card";
import { PersonAvatar, PersonStack } from "./person-avatar";
import { ProgressRing } from "./progress-ring";

export interface ClassCardPerson {
  readonly id: string;
  readonly name: string;
}

export interface ClassCardStat {
  readonly label: string;
  readonly value: ReactNode;
  /** `alert` : chiffre en rouge (élèves bloqués…). */
  readonly tone?: "default" | "alert" | undefined;
}

export interface ClassCardProps {
  /** « 4e B · Mathématiques ». */
  readonly title: ReactNode;
  /** Établissement, niveau, horaire… */
  readonly subtitle?: ReactNode;
  /** Glyphe Phosphor (élément) dans une `GlowTile`, ou `media` à la place. */
  readonly icon?: ReactNode;
  /** Pastille déjà faite (une `SubjectIcon`, par exemple). */
  readonly media?: ReactNode;
  /** Teinte de la coque (et de la pastille). */
  readonly tone?: CardTone | undefined;
  /** Avancement de la classe, de 0 à 100. */
  readonly progress?: number | undefined;
  /** Nom accessible de l'anneau (« Notions validées par la classe »). */
  readonly progressLabel?: string | undefined;
  /** Deux à quatre chiffres sous l'en-tête. */
  readonly stats?: readonly ClassCardStat[] | undefined;
  /** Élèves de la classe : avatars empilés. */
  readonly students?: readonly ClassCardPerson[] | undefined;
  /** Libellé à côté des avatars (« 28 élèves »). */
  readonly studentsLabel?: ReactNode;
  /** Élèves à surveiller (bloqués…), en pastilles colorées. */
  readonly flagged?: readonly ClassCardPerson[] | undefined;
  readonly flaggedLabel?: ReactNode;
  /** Bouton ou lien, en bas à droite. */
  readonly action?: ReactNode;
  /** Niveau du titre (le `h1` de la page reste unique). */
  readonly titleAs?: "h2" | "h3" | "h4" | undefined;
  readonly className?: string | undefined;
}

const GLOW_FOR: Record<CardTone, GlowTone> = {
  neutral: "slate",
  brand: "yellow",
  mint: "mint",
  sky: "sky",
  amber: "amber",
  rose: "rose",
};

/**
 * Carte de classe « avec du pep » : coque teintée, pastille, anneau de
 * progression, chiffres, élèves en avatars colorés, et la carte se soulève
 * au survol (immobile si l'utilisateur réduit les animations).
 */
export function ClassCard({
  title,
  subtitle,
  icon,
  media,
  tone = "sky",
  progress,
  progressLabel = "Avancement de la classe",
  stats,
  students,
  studentsLabel,
  flagged,
  flaggedLabel,
  action,
  titleAs: Title = "h3",
  className,
}: ClassCardProps) {
  return (
    <CardShell
      tone={tone}
      className={cn(
        "group/class h-full transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_22px_40px_-26px_rgb(23_23_20/0.55)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:hover:shadow-[0_22px_40px_-22px_rgb(0_0_0/0.95)]",
        className,
      )}
    >
      <article
        data-slot="class-card"
        className={cn(
          "flex flex-1 flex-col gap-4 rounded-card border border-border bg-card p-5",
          CARD_INNER_SHADOW,
        )}
      >
        <div className="flex items-start gap-3">
          {media ??
            (icon ? (
              <GlowTile
                tone={GLOW_FOR[tone]}
                size={44}
                className="transition-transform duration-300 group-hover/class:scale-105 group-hover/class:-rotate-3 motion-reduce:transition-none motion-reduce:group-hover/class:scale-100 motion-reduce:group-hover/class:rotate-0"
              >
                {icon}
              </GlowTile>
            ) : null)}
          <div className="min-w-0 flex-1 pt-0.5">
            <Title className="line-clamp-2 leading-snug font-semibold tracking-tight">
              {title}
            </Title>
            {subtitle ? (
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
          {progress !== undefined ? (
            <ProgressRing
              value={progress}
              label={progressLabel}
              size={52}
              thickness={5}
              tone={tone === "mint" ? "mint" : "brand"}
            />
          ) : null}
        </div>

        {stats && stats.length > 0 ? (
          <dl
            className="grid gap-3 rounded-control bg-muted/60 px-3 py-2.5"
            style={{
              gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
            }}
          >
            {stats.map((s) => (
              <div key={s.label} className="flex min-w-0 flex-col gap-0.5">
                <dt className="truncate font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                  {s.label}
                </dt>
                <dd
                  className={cn(
                    "text-xl font-light tabular-nums",
                    s.tone === "alert" && "text-danger-text",
                  )}
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {students && students.length > 0 ? (
          <div className="flex items-center gap-2.5">
            <PersonStack people={students} max={5} size="sm" />
            {studentsLabel ? (
              <span className="text-xs text-muted-foreground">
                {studentsLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        {flagged && flagged.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {flaggedLabel ? (
              <p className="font-mono text-[10px] tracking-[0.12em] text-danger-text uppercase">
                {flaggedLabel}
              </p>
            ) : null}
            <ul className="flex flex-wrap gap-1.5">
              {flagged.map((p) => (
                <li
                  key={p.id}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-danger/20 bg-danger-soft py-0.5 pr-2.5 pl-0.5 text-xs font-medium text-danger-text"
                >
                  <PersonAvatar
                    name={p.name}
                    seed={p.id}
                    size="xs"
                    decorative
                  />
                  {p.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {action ? (
          <div className="mt-auto flex justify-end">{action}</div>
        ) : null}
      </article>
    </CardShell>
  );
}
