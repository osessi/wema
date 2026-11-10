import {
  asCountryCode,
  asCountryId,
  asGradeId,
  asNotionId,
  asProgramId,
  asSubjectId,
  asUnitId,
  type Notion,
} from "@wema/domain";
import { describe, expect, it } from "vitest";
import {
  assembleCurriculum,
  type CurriculumError,
  type CurriculumRows,
  checkPrerequisiteChange,
} from "./index";

const countryId = asCountryId("00000000-0000-4000-8000-000000000001");
const gradeId = asGradeId("00000000-0000-4000-8000-000000000002");
const subjectId = asSubjectId("00000000-0000-4000-8000-000000000003");
const programId = asProgramId("00000000-0000-4000-8000-000000000004");
const unitId = asUnitId("00000000-0000-4000-8000-000000000005");

function notion(code: string, overrides: Partial<Notion> = {}): Notion {
  return {
    id: asNotionId(`n-${code}`),
    unitId,
    code,
    name: code,
    description: `Notion ${code}`,
    position: 0,
    prerequisites: [],
    misconceptions: [],
    verified: false,
    archived: false,
    ...overrides,
  };
}

function rows(
  notions: Notion[],
  overrides: Partial<CurriculumRows> = {},
): CurriculumRows {
  return {
    country: {
      id: countryId,
      code: asCountryCode("FR"),
      name: "France",
      unitLabel: { singular: "Chapitre", plural: "Chapitres" },
      archived: false,
    },
    subjects: [
      {
        id: subjectId,
        code: "maths",
        name: "Mathématiques",
        icon: "math",
        archived: false,
      },
    ],
    grades: [
      { id: gradeId, countryId, name: "4e", position: 0, archived: false },
    ],
    programs: [
      { id: programId, countryId, gradeId, subjectId, archived: false },
    ],
    units: [
      {
        id: unitId,
        programId,
        name: "U",
        description: "",
        position: 0,
        archived: false,
      },
    ],
    notions,
    ...overrides,
  };
}

function errorsOf(input: CurriculumRows): CurriculumError[] {
  const result = assembleCurriculum(input);
  if (result.ok) throw new Error("une erreur était attendue");
  return result.error;
}

const id = (code: string) => asNotionId(`n-${code}`);

describe("assembleCurriculum", () => {
  it("assemble un référentiel valide et range les notions par unité", () => {
    const result = assembleCurriculum(
      rows([
        notion("b", { position: 1, prerequisites: [id("a")] }),
        notion("a"),
      ]),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.getNotion(id("b"))?.prerequisites).toEqual([id("a")]);
    expect(result.value.notionsOfUnit(unitId).map((n) => n.code)).toEqual([
      "a",
      "b",
    ]);
  });

  it("signale un prérequis inconnu (par exemple d'un autre pays)", () => {
    expect(
      errorsOf(rows([notion("a", { prerequisites: [id("ailleurs")] })])),
    ).toContainEqual({
      kind: "unknown_prerequisite",
      notionId: id("a"),
      prerequisiteId: id("ailleurs"),
    });
  });

  it("signale un cycle de prérequis", () => {
    const errors = errorsOf(
      rows([
        notion("a", { prerequisites: [id("b")] }),
        notion("b", { prerequisites: [id("a")] }),
      ]),
    );
    expect(errors.find((e) => e.kind === "prerequisite_cycle")).toBeDefined();
  });

  it("refuse deux notions avec le même code dans le pays", () => {
    expect(
      errorsOf(rows([notion("a"), notion("a", { id: asNotionId("autre") })])),
    ).toContainEqual({
      kind: "duplicate_notion_code",
      code: "a",
    });
  });

  it("refuse une classe d'un autre pays et deux programmes pour la même classe et matière", () => {
    const errors = errorsOf(
      rows([], {
        grades: [
          {
            id: gradeId,
            countryId: asCountryId("autre-pays"),
            name: "4e",
            position: 0,
            archived: false,
          },
        ],
        programs: [
          { id: programId, countryId, gradeId, subjectId, archived: false },
          {
            id: asProgramId("p2"),
            countryId,
            gradeId,
            subjectId,
            archived: false,
          },
        ],
      }),
    );
    expect(errors).toContainEqual({
      kind: "foreign_row",
      id: gradeId,
      countryId: "autre-pays",
    });
    expect(errors).toContainEqual({
      kind: "duplicate_program",
      gradeId,
      subjectId,
    });
  });

  it("signale une notion rattachée à une unité inconnue", () => {
    expect(
      errorsOf(rows([notion("a", { unitId: asUnitId("perdue") })])),
    ).toContainEqual({
      kind: "unknown_unit",
      notionId: id("a"),
      unitId: "perdue",
    });
  });
});

describe("checkPrerequisiteChange", () => {
  const curriculum = (() => {
    const r = assembleCurriculum(
      rows([
        notion("a"),
        notion("b", { prerequisites: [id("a")] }),
        notion("vieille", { archived: true }),
      ]),
    );
    if (!r.ok) throw new Error("référentiel de test invalide");
    return r.value;
  })();

  it("accepte un prérequis valide", () => {
    expect(
      checkPrerequisiteChange(curriculum, id("vieille"), [id("b")]).ok,
    ).toBe(true);
  });

  it("refuse un changement qui crée un cycle", () => {
    const result = checkPrerequisiteChange(curriculum, id("a"), [id("b")]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error[0]?.kind).toBe("prerequisite_cycle");
  });

  it("refuse une notion qui serait son propre prérequis", () => {
    expect(checkPrerequisiteChange(curriculum, id("a"), [id("a")]).ok).toBe(
      false,
    );
  });

  it("refuse d'ajouter une notion archivée ou inconnue", () => {
    const result = checkPrerequisiteChange(curriculum, id("a"), [
      id("vieille"),
      id("zzz"),
    ]);
    if (result.ok) throw new Error("une erreur était attendue");
    expect(result.error.map((e) => e.kind)).toEqual([
      "archived_prerequisite",
      "unknown_prerequisite",
    ]);
  });
});
