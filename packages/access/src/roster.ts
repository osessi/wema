import type { Result } from "@wema/domain";
import { err, ok } from "@wema/domain";
import { normalizeEmail } from "./identifiers";

/**
 * Inscription d'élèves en masse (école, prof particulier) : lecture d'une
 * liste collée depuis un tableur ou d'un fichier CSV. Colonnes, dans l'ordre
 * ou nommées par une ligne d'en-tête : prénom, nom, classe (facultative),
 * e-mail du parent (facultatif). Rien n'est créé ici : on lit, on valide, on
 * signale chaque erreur à sa ligne.
 */

/** Élèves au plus par import (chaque compte coûte un calcul de code chiffré). */
export const ROSTER_MAX_ROWS = 100;
/** Taille au plus du texte collé ou du fichier, en octets (UTF-8). */
export const ROSTER_MAX_BYTES = 64 * 1024;
/** Longueur au plus d'un prénom, d'un nom ou d'un nom de classe. */
export const ROSTER_FIELD_MAX = 60;

export type RosterRowError =
  | "first_name_missing"
  | "last_name_missing"
  | "field_too_long"
  | "invalid_characters"
  | "invalid_parent_email"
  | "duplicate_learner";

export interface RosterRow {
  /** Ligne du texte où commence l'élève (1 pour la première). */
  line: number;
  firstName: string;
  lastName: string;
  className: string | null;
  parentEmail: string | null;
  errors: RosterRowError[];
  /** Pour un doublon : la ligne où l'élève apparaît déjà. */
  duplicateOf?: number;
}

export type RosterError =
  | { kind: "roster_empty" }
  | { kind: "roster_too_large"; maxBytes: number }
  | { kind: "roster_too_many_rows"; maxRows: number };

type Column = "firstName" | "lastName" | "className" | "parentEmail";
const DEFAULT_COLUMNS: readonly Column[] = [
  "firstName",
  "lastName",
  "className",
  "parentEmail",
];

/** Minuscules, sans accents ni espaces superflus : pour comparer des noms. */
export function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Nom de colonne reconnu dans une ligne d'en-tête. */
function headerColumn(cell: string): Column | null {
  const k = foldName(cell).replace(/[^a-z]/g, "");
  if (["prenom", "prenoms", "firstname"].includes(k)) return "firstName";
  if (["nom", "nomdefamille", "lastname", "name"].includes(k))
    return "lastName";
  if (["classe", "groupe", "class", "group"].includes(k)) return "className";
  if (
    k.includes("mail") ||
    k.includes("courriel") ||
    ["parent", "emailparent"].includes(k)
  )
    return "parentEmail";
  return null;
}

/** Séparateur de la première ligne : tabulation (tableur), point-virgule ou virgule. */
function detectDelimiter(firstLine: string): string {
  const count = (ch: string) => firstLine.split(ch).length - 1;
  if (count("\t") > 0) return "\t";
  return count(";") >= count(",") && count(";") > 0 ? ";" : ",";
}

/** Découpe un texte CSV en enregistrements (guillemets et "" gérés). */
function records(
  text: string,
  delimiter: string,
): { line: number; cells: string[] }[] {
  const out: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let start = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else {
        if (ch === "\n") line++;
        cell += ch;
      }
    } else if (ch === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (ch === delimiter) {
      cells.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cells.push(cell);
      out.push({ line: start, cells });
      cells = [];
      cell = "";
      line++;
      start = line;
    } else cell += ch;
  }
  cells.push(cell);
  out.push({ line: start, cells });
  return out.filter((r) => r.cells.some((c) => c.trim() !== ""));
}

const clean = (value: string | undefined) =>
  (value ?? "").replace(/\s+/g, " ").trim();

// Caractères de contrôle, et symboles qui n'ont rien à faire dans un nom.
const FORBIDDEN = /[\p{Cc}<>{}\\|@#$%^*=_~`[\]]/u;

/** Lit et valide une liste d'élèves. Erreur globale, ou une ligne par élève. */
export function parseRoster(text: string): Result<RosterRow[], RosterError> {
  if (new TextEncoder().encode(text).length > ROSTER_MAX_BYTES)
    return err({ kind: "roster_too_large", maxBytes: ROSTER_MAX_BYTES });
  const body = text.replace(/^﻿/, "");
  const firstLine = body.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  let list = records(body, detectDelimiter(firstLine));
  if (list.length === 0) return err({ kind: "roster_empty" });

  // En-tête : colonnes nommées (dans n'importe quel ordre).
  let columns: readonly (Column | null)[] = DEFAULT_COLUMNS;
  const header = list[0]?.cells.map(headerColumn) ?? [];
  if (header.includes("firstName") && header.includes("lastName")) {
    columns = header;
    list = list.slice(1);
  }
  if (list.length === 0) return err({ kind: "roster_empty" });
  if (list.length > ROSTER_MAX_ROWS)
    return err({ kind: "roster_too_many_rows", maxRows: ROSTER_MAX_ROWS });

  const seen = new Map<string, number>();
  const rows = list.map(({ line, cells }): RosterRow => {
    const get = (column: Column) => {
      const i = columns.indexOf(column);
      return i < 0 ? "" : clean(cells[i]);
    };
    const firstName = get("firstName");
    const lastName = get("lastName");
    const className = get("className");
    const rawEmail = get("parentEmail");
    const errors: RosterRowError[] = [];
    if (!firstName) errors.push("first_name_missing");
    if (!lastName) errors.push("last_name_missing");
    if (
      [firstName, lastName, className].some((v) => v.length > ROSTER_FIELD_MAX)
    )
      errors.push("field_too_long");
    if ([firstName, lastName, className].some((v) => FORBIDDEN.test(v)))
      errors.push("invalid_characters");
    let parentEmail: string | null = null;
    if (rawEmail) {
      const email = normalizeEmail(rawEmail);
      if (email.ok) parentEmail = email.value;
      else errors.push("invalid_parent_email");
    }
    const row: RosterRow = {
      line,
      firstName,
      lastName,
      className: className || null,
      parentEmail,
      errors,
    };
    if (firstName && lastName) {
      const key = [firstName, lastName, className].map(foldName).join("|");
      const first = seen.get(key);
      if (first === undefined) seen.set(key, line);
      else {
        errors.push("duplicate_learner");
        row.duplicateOf = first;
      }
    }
    return row;
  });
  return ok(rows);
}

/** Longueur au plus d'un identifiant proposé, pour garder la place d'un numéro. */
const USERNAME_BASE_MAX = 28;

/**
 * Identifiant proposé pour un élève : « prenom.nom » sans accents, en
 * minuscules (règles de `normalizeUsername`).
 */
export function usernameBase(firstName: string, lastName: string): string {
  const part = (v: string) =>
    foldName(v)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const base = [part(firstName), part(lastName)]
    .filter(Boolean)
    .join(".")
    .slice(0, USERNAME_BASE_MAX)
    .replace(/[.-]+$/, "");
  return /^[a-z0-9]/.test(base) && base.length >= 3
    ? base
    : `eleve-${base}`.replace(/[.-]+$/, "").slice(0, USERNAME_BASE_MAX);
}

/** Identifiants à essayer dans l'ordre : base, base2, base3… */
export function* usernameCandidates(base: string): Generator<string> {
  yield base;
  for (let n = 2; n < 1000; n++) yield `${base}${n}`;
}
