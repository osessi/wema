/**
 * Fiche de propriétés : libellé à gauche, valeur à droite (fiche élève, fiche école).
 *
 * Source : ZeroAds `packages/ui/src/patterns/property-list.tsx` (code d'Olivier ; la
 * technique de la colonne de libellés en variable CSS y avait été réécrite d'après
 * l'étude de Twenty CRM, aucun code AGPL repris). Adapté à Wema : libellés en Geist,
 * valeur sélectionnable, une valeur absente dit ce qui manque (« Non renseigné »),
 * jamais un tiret ni un zéro. Rendu possible côté serveur.
 *
 * Props de `PropertyList` : `labelWidth` (« 9rem »), `stack` (libellé au-dessus de la
 * valeur sous 640 px), `children` (des `Property`).
 * Props de `Property` : `label`, `icon` (glyphe Phosphor 16 px), `children` (la valeur ;
 * `undefined`, `null`, `false` ou `""` = absente), `absent` (« Non renseigné »).
 */
import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../lib/utils";

type VarStyle = CSSProperties & Record<`--${string}`, string>;
const labelStyle = (width: string): VarStyle => ({
  "--property-label-width": width,
});

export interface PropertyListProps {
  readonly children: ReactNode;
  readonly labelWidth?: string | undefined;
  readonly stack?: boolean | undefined;
  readonly className?: string | undefined;
}

export function PropertyList({
  children,
  labelWidth = "9rem",
  stack = true,
  className,
}: PropertyListProps) {
  return (
    <dl
      className={cn("group/props flex flex-col gap-3", className)}
      style={labelStyle(labelWidth)}
      data-stack={stack ? "" : undefined}
      data-slot="property-list"
    >
      {children}
    </dl>
  );
}

export interface PropertyProps {
  readonly label: ReactNode;
  readonly icon?: ReactNode;
  readonly children?: ReactNode;
  readonly absent?: ReactNode;
  readonly className?: string | undefined;
}

export function Property({
  label,
  icon,
  children,
  absent = "Non renseigné",
  className,
}: PropertyProps) {
  const empty =
    children === undefined ||
    children === null ||
    children === false ||
    children === "";
  return (
    <div
      className={cn(
        "flex items-start gap-x-3 gap-y-0.5 group-data-stack/props:max-sm:flex-col",
        className,
      )}
      data-slot="property"
      data-absent={empty ? "" : undefined}
    >
      <dt className="flex w-(--property-label-width) shrink-0 items-center gap-1.5 py-px text-[13px] text-muted-foreground select-none group-data-stack/props:max-sm:w-auto">
        {icon ? (
          <span
            aria-hidden
            className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4"
          >
            {icon}
          </span>
        ) : null}
        <span className="truncate">{label}</span>
      </dt>
      <dd
        className={cn(
          "min-w-0 flex-1 py-px text-[13px] select-text",
          empty ? "text-muted-foreground italic" : "text-foreground",
        )}
      >
        {empty ? absent : children}
      </dd>
    </div>
  );
}
