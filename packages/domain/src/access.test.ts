import { describe, expect, it } from "vitest";
import { isPermission, PERMISSIONS, permissionScope } from "./index";

describe("catalogue des permissions", () => {
  it("n'a pas de doublon", () => {
    const ids = PERMISSIONS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reconnaît une permission du catalogue et refuse le reste", () => {
    expect(isPermission("curriculum.write")).toBe(true);
    expect(isPermission("curriculum.delete")).toBe(false);
  });

  it("le référentiel ne s'écrit qu'au niveau de la plateforme", () => {
    expect(permissionScope("curriculum.write")).toBe("platform");
    expect(permissionScope("members.manage")).toBe("organization");
  });
});
