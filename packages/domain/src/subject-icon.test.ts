import { describe, expect, it } from "vitest";
import { isSubjectIcon, SUBJECT_ICONS } from "./curriculum";

describe("icône de matière", () => {
  it("accepte une clé de la liste fermée", () => {
    for (const key of SUBJECT_ICONS) expect(isSubjectIcon(key)).toBe(true);
  });

  it("refuse une clé inconnue, vide ou mal écrite", () => {
    for (const key of ["", "maths", "Math", " math", "lucide-book", "<svg>"])
      expect(isSubjectIcon(key)).toBe(false);
  });

  it("n'a pas de doublon", () => {
    expect(new Set(SUBJECT_ICONS).size).toBe(SUBJECT_ICONS.length);
  });
});
