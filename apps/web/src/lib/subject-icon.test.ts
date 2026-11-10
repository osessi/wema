import { SUBJECT_ICONS } from "@wema/domain";
import { SUBJECT_ICON_NAMES } from "@wema/ui/components/wema/subject-icon";
import { describe, expect, it } from "vitest";

describe("icônes de matière", () => {
  it("chaque clé de la liste fermée du domaine a son dessin, et rien de plus", () => {
    expect([...SUBJECT_ICON_NAMES].sort()).toEqual([...SUBJECT_ICONS].sort());
  });
});
