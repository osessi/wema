import { asNotionId } from "@wema/domain";
import { describe, expect, it } from "vitest";
import { buildCurriculum, type CurriculumError } from "./index";

const countries = [{ code: "fr", name: "France" }];
const subjects = [{ id: "maths", name: "Mathématiques" }];

function notion(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    subject: "maths",
    name: id,
    description: `Notion ${id}`,
    prerequisites: [],
    misconceptions: [],
    mappings: { fr: { grade: "4e", chapter: null, verified: false } },
    ...overrides,
  };
}

function errorsOf(notions: unknown[]): CurriculumError[] {
  const result = buildCurriculum({ countries, subjects, notions });
  if (result.ok) throw new Error("une erreur était attendue");
  return result.error;
}

describe("buildCurriculum", () => {
  it("construit un référentiel valide et retrouve les prérequis", () => {
    const result = buildCurriculum({
      countries,
      subjects,
      notions: [
        notion("maths.a"),
        notion("maths.b", { prerequisites: ["maths.a"] }),
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.value.getNotion(asNotionId("maths.b"))?.prerequisites,
      ).toEqual(["maths.a"]);
    }
  });

  it("signale un prérequis inexistant", () => {
    expect(
      errorsOf([notion("maths.a", { prerequisites: ["maths.zzz"] })]),
    ).toContainEqual({
      kind: "unknown_prerequisite",
      notionId: "maths.a",
      prerequisiteId: "maths.zzz",
    });
  });

  it("signale un cycle de prérequis", () => {
    const errors = errorsOf([
      notion("maths.a", { prerequisites: ["maths.b"] }),
      notion("maths.b", { prerequisites: ["maths.a"] }),
    ]);
    const cycle = errors.find((e) => e.kind === "prerequisite_cycle");
    expect(cycle).toBeDefined();
    if (cycle?.kind === "prerequisite_cycle") {
      expect(cycle.cycle).toEqual(
        expect.arrayContaining(["maths.a", "maths.b"]),
      );
    }
  });

  it("signale un identifiant de notion en double", () => {
    expect(errorsOf([notion("maths.a"), notion("maths.a")])).toContainEqual({
      kind: "duplicate_id",
      id: "maths.a",
    });
  });

  it("signale une correspondance vers un pays non déclaré", () => {
    const errors = errorsOf([
      notion("maths.a", {
        mappings: { xx: { grade: "3e", chapter: 1, verified: false } },
      }),
    ]);
    expect(errors).toContainEqual({
      kind: "unknown_country",
      notionId: "maths.a",
      country: "xx",
    });
  });

  it("signale une idée fausse en double dans une notion", () => {
    const errors = errorsOf([
      notion("maths.a", {
        misconceptions: [
          { id: "erreur", description: "première" },
          { id: "erreur", description: "seconde" },
        ],
      }),
    ]);
    expect(errors).toContainEqual({
      kind: "duplicate_misconception",
      notionId: "maths.a",
      misconceptionId: "erreur",
    });
  });

  it("renvoie toutes les erreurs à la fois", () => {
    const errors = errorsOf([
      notion("maths.a", {
        prerequisites: ["maths.zzz"],
        mappings: { xx: { grade: "3e", chapter: 1, verified: false } },
      }),
    ]);
    expect(errors.map((e) => e.kind).sort()).toEqual([
      "unknown_country",
      "unknown_prerequisite",
    ]);
  });
});
