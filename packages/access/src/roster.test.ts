import { describe, expect, it } from "vitest";
import {
  normalizeUsername,
  parseRoster,
  ROSTER_MAX_BYTES,
  ROSTER_MAX_ROWS,
  usernameBase,
  usernameCandidates,
} from "./index";

const rows = (text: string) => {
  const parsed = parseRoster(text);
  if (!parsed.ok) throw new Error(parsed.error.kind);
  return parsed.value;
};

describe("liste d'élèves à importer", () => {
  it("lit un collage depuis un tableur (tabulations), sans en-tête", () => {
    expect(
      rows("Awa\tDossou\t6e A\tparent.awa@example.test\nKofi\tMensah"),
    ).toEqual([
      {
        line: 1,
        firstName: "Awa",
        lastName: "Dossou",
        className: "6e A",
        parentEmail: "parent.awa@example.test",
        errors: [],
      },
      {
        line: 2,
        firstName: "Kofi",
        lastName: "Mensah",
        className: null,
        parentEmail: null,
        errors: [],
      },
    ]);
  });

  it("lit un CSV au point-virgule avec en-tête dans un autre ordre, BOM et guillemets", () => {
    const list = rows(
      '﻿Nom;Prénom;E-mail du parent;Classe\r\n"Da Silva; Junior";Léa;;4e B\r\n',
    );
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      line: 2,
      firstName: "Léa",
      lastName: "Da Silva; Junior",
      className: "4e B",
      parentEmail: null,
    });
  });

  it("lit un CSV à la virgule et ignore les lignes vides", () => {
    const list = rows("prenom,nom\n\nAma,Kouassi\n  \nYao,Koffi\n");
    expect(list.map((r) => [r.line, r.firstName])).toEqual([
      [3, "Ama"],
      [5, "Yao"],
    ]);
  });

  it("signale les erreurs ligne par ligne", () => {
    const list = rows(
      "Awa;;;\n;Mensah;;\nKofi;Mensah;;pas-un-email\nJean<script>;Doe;;",
    );
    expect(list.map((r) => r.errors)).toEqual([
      ["last_name_missing"],
      ["first_name_missing"],
      ["invalid_parent_email"],
      ["invalid_characters"],
    ]);
  });

  it("refuse un champ trop long", () => {
    expect(rows(`${"a".repeat(61)};Nom`)[0]?.errors).toEqual([
      "field_too_long",
    ]);
  });

  it("repère les doublons (casse et accents ignorés) et indique la première ligne", () => {
    const list = rows("Léa;Dossou;6e\nlea;DOSSOU;6e\nLéa;Dossou;5e");
    expect(list[1]?.errors).toEqual(["duplicate_learner"]);
    expect(list[1]?.duplicateOf).toBe(1);
    // Même nom dans une autre classe : pas un doublon.
    expect(list[2]?.errors).toEqual([]);
  });

  it("accepte le même e-mail de parent pour des frères et sœurs", () => {
    const list = rows("Awa;Dossou;;p@example.test\nAmi;Dossou;;P@Example.test");
    expect(list.map((r) => r.parentEmail)).toEqual([
      "p@example.test",
      "p@example.test",
    ]);
    expect(list.every((r) => r.errors.length === 0)).toBe(true);
  });

  it("refuse une liste vide, trop longue ou trop lourde", () => {
    expect(parseRoster(" \n\n")).toEqual({
      ok: false,
      error: { kind: "roster_empty" },
    });
    expect(parseRoster("Prénom;Nom\n")).toEqual({
      ok: false,
      error: { kind: "roster_empty" },
    });
    const many = Array.from(
      { length: ROSTER_MAX_ROWS + 1 },
      (_, i) => `A${i};B`,
    ).join("\n");
    expect(parseRoster(many)).toEqual({
      ok: false,
      error: { kind: "roster_too_many_rows", maxRows: ROSTER_MAX_ROWS },
    });
    expect(
      parseRoster(
        Array.from({ length: 50 }, () =>
          "é".repeat(ROSTER_MAX_BYTES / 80),
        ).join("\n"),
      ),
    ).toEqual({
      ok: false,
      error: { kind: "roster_too_large", maxBytes: ROSTER_MAX_BYTES },
    });
    expect(parseRoster(`A;B\n`.repeat(ROSTER_MAX_ROWS)).ok).toBe(true);
  });
});

describe("identifiant proposé", () => {
  it("donne prenom.nom sans accents, valide pour la connexion", () => {
    expect(usernameBase("Léa-Marie", "N'Guessan")).toBe("lea-marie.n-guessan");
    expect(normalizeUsername(usernameBase("Léa-Marie", "N'Guessan")).ok).toBe(
      true,
    );
  });

  it("reste valide pour un nom très court, très long ou sans lettre latine", () => {
    for (const [first, last] of [
      ["A", "B"],
      ["Jean-Baptiste-Emmanuel", "de la Fontaine-Dupont"],
      ["李", "王"],
    ] as const) {
      const base = usernameBase(first, last);
      expect(base.length).toBeLessThanOrEqual(28);
      expect(normalizeUsername(`${base}999`).ok).toBe(true);
    }
  });

  it("propose base, base2, base3…", () => {
    const it = usernameCandidates("awa.dossou");
    expect([it.next().value, it.next().value, it.next().value]).toEqual([
      "awa.dossou",
      "awa.dossou2",
      "awa.dossou3",
    ]);
  });
});
