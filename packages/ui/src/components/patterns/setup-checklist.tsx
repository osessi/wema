/**
 * Liste de démarrage : ce qui reste à faire pour bien commencer, avec la progression.
 *
 * Source : ZeroAds `apps/web/src/components/overview/setup-progress.tsx` (code d'Olivier),
 * adapté à Wema : jaune pour l'étape en cours, coche encre pour une étape faite,
 * ton bienveillant (pas de rouge pour un démarrage inachevé). Sans état client :
 * rendu possible côté serveur.
 *
 * Props :
 * - `title` (« Bien démarrer »), `description` facultative.
 * - `items` : `{ id, label, description?, status: "done" | "current" | "pending" | "optional", action? }[]`.
 *   `action` : un lien ou un bouton fourni par l'appelant, montré sur l'étape en cours.
 * - `action` : l'action principale (« Continuer ») sous la liste, ou à droite en `compact`.
 * - `compact` : une seule ligne (titre, compteur, barre, action) pour un tableau de bord.
 * - `labels` : `count(done, total)`, `status` (textes des statuts), `progress` (nom de la barre).
 */
import { CheckIcon, CircleDashedIcon } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export type SetupStatus = "done" | "current" | "pending" | "optional";

export interface SetupItem {
  readonly id: string;
  readonly label: ReactNode;
  readonly description?: ReactNode;
  readonly status: SetupStatus;
  readonly action?: ReactNode;
}

const STATUS: Record<SetupStatus, string> = {
  done: "Fait",
  current: "En cours",
  pending: "À venir",
  optional: "Facultatif",
};

export interface SetupChecklistProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly items: readonly SetupItem[];
  readonly action?: ReactNode;
  readonly compact?: boolean | undefined;
  readonly labels?: {
    readonly count?: ((done: number, total: number) => string) | undefined;
    readonly status?: Partial<Record<SetupStatus, string>> | undefined;
    readonly progress?: string | undefined;
  };
  readonly className?: string | undefined;
}

function Bar({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className="h-1.5 w-full overflow-hidden rounded-pill bg-muted shadow-[inset_0_0_0_1px_var(--border)]"
    >
      <div
        className="h-full rounded-pill bg-brand transition-[width] duration-500 ease-arrive motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function SetupChecklist({
  title,
  description,
  items,
  action,
  compact = false,
  labels,
  className,
}: SetupChecklistProps) {
  const total = items.length;
  const done = items.filter((item) => item.status === "done").length;
  const countText = (labels?.count ?? ((d, t) => `${d} sur ${t}`))(done, total);
  const status = { ...STATUS, ...labels?.status };
  const progressLabel = labels?.progress ?? "Progression du démarrage";

  if (compact) {
    return (
      <section
        className={cn(
          "flex flex-wrap items-center gap-x-5 gap-y-3 rounded-card border border-border bg-card px-4 py-3",
          className,
        )}
        data-slot="setup-checklist"
        data-compact=""
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-foreground">
            {title}
            <span className="ms-2 font-mono text-xs text-muted-foreground tabular-nums">
              {countText}
            </span>
          </h2>
          {description ? (
            <p className="text-[13px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="w-full sm:w-40">
          <Bar done={done} total={total} label={progressLabel} />
        </div>
        {action}
      </section>
    );
  }

  return (
    <section
      className={cn(
        "rounded-card border border-border bg-card p-5 shadow-xs",
        className,
      )}
      data-slot="setup-checklist"
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-pill bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground tabular-nums">
          {countText}
        </span>
      </header>
      <div className="mt-4">
        <Bar done={done} total={total} label={progressLabel} />
      </div>
      <ol className="mt-4 grid gap-1">
        {items.map((item, i) => (
          <li
            key={item.id}
            aria-current={item.status === "current" ? "step" : undefined}
            className={cn(
              "flex items-start gap-3 rounded-control px-2 py-2",
              item.status === "current" && "bg-brand-subtle",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-px grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[11px] font-medium tabular-nums",
                item.status === "done" &&
                  "border-transparent bg-foreground text-background",
                item.status === "current" &&
                  "border-transparent bg-brand text-ink-on-brand ring-4 ring-brand/25",
                item.status === "pending" &&
                  "border-border bg-card text-muted-foreground",
                item.status === "optional" &&
                  "border-dashed border-line-strong bg-card text-muted-foreground",
              )}
            >
              {item.status === "done" ? (
                <CheckIcon weight="bold" className="size-3" />
              ) : item.status === "optional" ? (
                <CircleDashedIcon weight="bold" className="size-3" />
              ) : (
                i + 1
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm",
                  item.status === "done" &&
                    "text-muted-foreground line-through decoration-foreground/25",
                  item.status === "current" && "font-medium text-foreground",
                  item.status === "pending" && "text-foreground",
                  item.status === "optional" && "text-muted-foreground",
                )}
              >
                {item.label}
                <span className="sr-only">, {status[item.status]}</span>
              </p>
              {item.description && item.status !== "done" ? (
                <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
              {item.action && item.status === "current" ? (
                <div className="mt-2">{item.action}</div>
              ) : null}
            </div>
            <span
              aria-hidden
              className={cn(
                "shrink-0 pt-0.5 font-mono text-[10px] tracking-wide uppercase",
                item.status === "done"
                  ? "text-success-text"
                  : "text-muted-foreground",
                item.status === "current" && "text-brand-text",
              )}
            >
              {status[item.status]}
            </span>
          </li>
        ))}
      </ol>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
