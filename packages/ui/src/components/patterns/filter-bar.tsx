"use client";

/**
 * Barre de filtres d'une liste : recherche, filtres en listes natives, compteur
 * de résultats et « Effacer les filtres ».
 *
 * Source : ZeroAds `packages/ui/src/patterns/filter-bar.tsx` (code d'Olivier : un filtre
 * court plutôt qu'un menu de commandes ; l'idée de Dub y avait été étudiée, aucun code
 * AGPL repris). Adapté à Wema : contrôlé par l'appelant (qui peut écrire l'état dans
 * l'URL), listes natives (`NativeSelect`, lisibles par les tests e2e et natives sur
 * téléphone), compteur en Geist Mono. Les textes passent en props.
 *
 * Props :
 * - `query`, `onQueryChange` : la recherche (absente si `onQueryChange` n'est pas fourni) ;
 *   `searchLabel` (« Rechercher »), `searchPlaceholder`.
 * - `filters` : `{ id, label, value, options: { value, label }[], onChange }[]`.
 *   L'option de valeur `""` signifie « tous ».
 * - `count`, `total` : « 12 sur 40 » (ou « 40 » sans filtre) ; `countLabel(count, total)`.
 * - `onReset` : affiche « Effacer » quand un filtre ou une recherche est actif ; `resetLabel`.
 * - `actions` : à droite (un bouton d'action).
 * - `label` : nom accessible de la barre (« Filtrer les élèves »).
 */
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { NativeSelect } from "../ui/native-select";

export interface FilterOption {
  readonly value: string;
  readonly label: string;
}

export interface FilterDef {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly FilterOption[];
  readonly onChange: (value: string) => void;
}

export interface FilterBarProps {
  readonly label: string;
  readonly query?: string | undefined;
  readonly onQueryChange?: ((query: string) => void) | undefined;
  readonly searchLabel?: string | undefined;
  readonly searchPlaceholder?: string | undefined;
  readonly filters?: readonly FilterDef[] | undefined;
  readonly count?: number | undefined;
  readonly total?: number | undefined;
  readonly countLabel?:
    | ((count: number, total: number | undefined) => string)
    | undefined;
  readonly onReset?: (() => void) | undefined;
  readonly resetLabel?: string | undefined;
  readonly actions?: ReactNode;
  readonly className?: string | undefined;
}

const fr = new Intl.NumberFormat("fr-FR");
const defaultCount = (count: number, total: number | undefined) =>
  total === undefined || total === count
    ? `${fr.format(count)} résultat${count > 1 ? "s" : ""}`
    : `${fr.format(count)} sur ${fr.format(total)}`;

export function FilterBar({
  label,
  query = "",
  onQueryChange,
  searchLabel = "Rechercher",
  searchPlaceholder = "Rechercher…",
  filters = [],
  count,
  total,
  countLabel = defaultCount,
  onReset,
  resetLabel = "Effacer les filtres",
  actions,
  className,
}: FilterBarProps) {
  const active = query.trim() !== "" || filters.some((f) => f.value !== "");
  return (
    <search
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-2", className)}
      data-slot="filter-bar"
    >
      {onQueryChange ? (
        <div className="relative min-w-48 flex-1 sm:max-w-72">
          <MagnifyingGlassIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            aria-label={searchLabel}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="h-9 w-full rounded-control border border-input bg-card pr-3 pl-9 text-sm text-foreground shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-foreground/35 focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-brand/45 motion-reduce:transition-none"
          />
        </div>
      ) : null}
      {filters.map((filter) => (
        <div key={filter.id} className="w-auto min-w-36">
          <NativeSelect
            aria-label={filter.label}
            value={filter.value}
            onChange={(event) => filter.onChange(event.target.value)}
            className={cn(
              filter.value !== "" && "border-foreground/40 bg-brand-subtle",
            )}
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      ))}
      {onReset && active ? (
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          <XIcon aria-hidden />
          {resetLabel}
        </Button>
      ) : null}
      <div className="ms-auto flex items-center gap-3">
        {count === undefined ? null : (
          <output
            aria-live="polite"
            className="font-mono text-xs text-muted-foreground tabular-nums"
          >
            {countLabel(count, total)}
          </output>
        )}
        {actions}
      </div>
    </search>
  );
}
