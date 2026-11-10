"use client";

import {
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretUpDown,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { useIsMobile } from "../../hooks/use-mobile";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

export type SortValue = string | number | Date | null | undefined;

export interface DataColumn<Row> {
  id: string;
  header: ReactNode;
  /** Contenu de la cellule. */
  cell: (row: Row) => ReactNode;
  /** Valeur de tri : la colonne devient triable si elle est fournie. */
  sortValue?: ((row: Row) => SortValue) | undefined;
  /** Texte cherché par la recherche (insensible aux accents et à la casse). */
  searchValue?: ((row: Row) => string) | undefined;
  align?: "start" | "end" | "center" | undefined;
  /** Titre de la carte en mobile (une seule colonne). */
  primary?: boolean | undefined;
  /** Masquée dans les cartes mobiles (actions dupliquées, détails). */
  hideOnMobile?: boolean | undefined;
  className?: string | undefined;
}

export interface DataTableLabels {
  search: string;
  searchPlaceholder: string;
  /** `{from}`, `{to}`, `{total}` remplacés par des nombres en `fr-FR`. */
  range: string;
  previous: string;
  next: string;
  /** `{page}` et `{pages}` remplacés. */
  page: string;
  sortAscending: string;
  sortDescending: string;
  noResults: string;
  pagination: string;
}

const DEFAULT_LABELS: DataTableLabels = {
  search: "Rechercher",
  searchPlaceholder: "Rechercher…",
  range: "{from}–{to} sur {total}",
  previous: "Page précédente",
  next: "Page suivante",
  page: "Page {page} sur {pages}",
  sortAscending: "Trier par ordre croissant",
  sortDescending: "Trier par ordre décroissant",
  noResults: "Aucun résultat pour cette recherche.",
  pagination: "Pagination",
};

export interface DataTableProps<Row> {
  /** Nom accessible du tableau. */
  label: string;
  columns: DataColumn<Row>[];
  rows: Row[];
  getRowId: (row: Row) => string;
  labels?: Partial<DataTableLabels> | undefined;
  /** Recherche affichée si au moins une colonne a `searchValue`. */
  searchable?: boolean | undefined;
  pageSize?: number | undefined;
  initialSort?: { id: string; desc?: boolean | undefined } | undefined;
  /** Affiché quand `rows` est vide (un `EmptyState`, en général). */
  empty?: ReactNode | undefined;
  /** Contenu à droite de la recherche (filtres, bouton). */
  toolbar?: ReactNode | undefined;
  className?: string | undefined;
}

const number = new Intl.NumberFormat("fr-FR");
const collator = new Intl.Collator("fr-FR", {
  sensitivity: "base",
  numeric: true,
});
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr-FR");

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");

function compare(a: SortValue, b: SortValue): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

const ALIGN = { start: "text-left", end: "text-right", center: "text-center" };

/**
 * Tableau de données : tri par colonne, recherche, pagination, et cartes
 * empilées sous 768 px. Fait sur la `table` shadcn, sans TanStack (le
 * besoin tient en quelques fonctions typées). En-têtes en mono 11 px.
 */
export function DataTable<Row>({
  label,
  columns,
  rows,
  getRowId,
  labels: labelsProp,
  searchable = true,
  pageSize = 10,
  initialSort,
  empty,
  toolbar,
  className,
}: DataTableProps<Row>) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const searchId = useId();
  const mobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ id: string; desc: boolean } | null>(
    initialSort
      ? { id: initialSort.id, desc: initialSort.desc ?? false }
      : null,
  );
  const [page, setPage] = useState(0);

  const searchColumns = columns.filter((c) => c.searchValue);
  const canSearch = searchable && searchColumns.length > 0;

  const visible = useMemo(() => {
    const q = fold(query.trim());
    let list = q
      ? rows.filter((r) =>
          searchColumns.some((c) => fold(c.searchValue?.(r) ?? "").includes(q)),
        )
      : rows;
    const column = sort && columns.find((c) => c.id === sort.id);
    if (sort && column?.sortValue) {
      const get = column.sortValue;
      list = [...list].sort(
        (a, b) => compare(get(a), get(b)) * (sort.desc ? -1 : 1),
      );
    }
    return list;
  }, [rows, query, sort, columns, searchColumns]);

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, pages - 1);
  const shown = visible.slice(current * pageSize, (current + 1) * pageSize);
  const primary = columns.find((c) => c.primary) ?? columns[0];

  function toggleSort(id: string) {
    setPage(0);
    setSort((s) =>
      s?.id !== id ? { id, desc: false } : s.desc ? null : { id, desc: true },
    );
  }

  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div data-slot="data-table" className={cn("min-w-0 space-y-3", className)}>
      {canSearch || toolbar ? (
        <div className="flex flex-wrap items-center gap-2">
          {canSearch ? (
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <label htmlFor={searchId} className="sr-only">
                {labels.search}
              </label>
              <MagnifyingGlass
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={searchId}
                type="search"
                value={query}
                placeholder={labels.searchPlaceholder}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                className="pl-8"
              />
            </div>
          ) : null}
          {toolbar ? (
            <div className="ml-auto flex flex-wrap gap-2">{toolbar}</div>
          ) : null}
        </div>
      ) : null}

      {/* Tableau à partir de 768 px, cartes en dessous (un seul des deux dans le DOM). */}
      {!mobile ? (
        <div className="overflow-hidden rounded-card border bg-card">
          <Table aria-label={label}>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                {columns.map((c) => {
                  const sorted = sort?.id === c.id ? sort : null;
                  return (
                    <TableHead
                      key={c.id}
                      aria-sort={
                        sorted
                          ? sorted.desc
                            ? "descending"
                            : "ascending"
                          : undefined
                      }
                      className={cn(
                        "h-10 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
                        ALIGN[c.align ?? "start"],
                        c.className,
                      )}
                    >
                      {c.sortValue ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.id)}
                          title={
                            sorted && !sorted.desc
                              ? labels.sortDescending
                              : labels.sortAscending
                          }
                          className="-mx-1.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-1 uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {c.header}
                          {sorted ? (
                            sorted.desc ? (
                              <CaretDown aria-hidden className="size-3" />
                            ) : (
                              <CaretUp aria-hidden className="size-3" />
                            )
                          ) : (
                            <CaretUpDown
                              aria-hidden
                              className="size-3 opacity-50"
                            />
                          )}
                        </button>
                      ) : (
                        c.header
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((row) => (
                <TableRow key={getRowId(row)}>
                  {columns.map((c) => (
                    <TableCell
                      key={c.id}
                      className={cn(ALIGN[c.align ?? "start"], c.className)}
                    >
                      {c.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <ul aria-label={label} className="space-y-2">
          {shown.map((row) => (
            <li key={getRowId(row)} className="rounded-card border bg-card p-3">
              {primary ? (
                <div className="mb-2 font-medium">{primary.cell(row)}</div>
              ) : null}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                {columns
                  .filter((c) => c !== primary && !c.hideOnMobile)
                  .map((c) => (
                    <div key={c.id} className="contents">
                      <dt className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                        {c.header}
                      </dt>
                      <dd className="min-w-0 text-right">{c.cell(row)}</dd>
                    </div>
                  ))}
              </dl>
            </li>
          ))}
        </ul>
      )}

      {visible.length === 0 ? (
        <p className="rounded-card border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {labels.noResults}
        </p>
      ) : null}

      {visible.length > pageSize ? (
        <nav
          aria-label={labels.pagination}
          className="flex items-center justify-between gap-2 text-sm text-muted-foreground"
        >
          <span className="tabular-nums">
            {fill(labels.range, {
              from: number.format(current * pageSize + 1),
              to: number.format(current * pageSize + shown.length),
              total: number.format(visible.length),
            })}
          </span>
          <span className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={labels.previous}
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <CaretLeft aria-hidden />
            </Button>
            <span aria-live="polite" className="px-1 tabular-nums">
              {fill(labels.page, {
                page: number.format(current + 1),
                pages: number.format(pages),
              })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={labels.next}
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              <CaretRight aria-hidden />
            </Button>
          </span>
        </nav>
      ) : null}
    </div>
  );
}
