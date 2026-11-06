import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROLES,
  isPermission,
  PERMISSIONS,
  permissionScope,
} from "./index";

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

describe("rôles par défaut d'une organisation", () => {
  it("chaque type a un rôle d'apprenant et un rôle qui gère les membres", () => {
    for (const roles of Object.values(DEFAULT_ROLES)) {
      expect(roles.filter((r) => r.learner)).toHaveLength(1);
      expect(roles.some((r) => r.permissions.includes("members.manage"))).toBe(
        true,
      );
      // Noms uniques dans l'organisation.
      expect(new Set(roles.map((r) => r.name)).size).toBe(roles.length);
    }
  });

  it("aucune permission de plateforme, l'apprenant ne gère rien", () => {
    for (const roles of Object.values(DEFAULT_ROLES))
      for (const r of roles) {
        expect(
          r.permissions.every((p) => permissionScope(p) === "organization"),
        ).toBe(true);
        if (r.learner) expect(r.permissions).toEqual(["curriculum.read"]);
      }
  });

  it("le parent lit, déclare et consent pour la santé ; la direction lit seulement", () => {
    const parent = DEFAULT_ROLES.family.find((r) => r.name === "Parent");
    expect(parent?.permissions).toEqual(
      expect.arrayContaining([
        "learners.health.read",
        "learners.health.write",
        "members.manage",
      ]),
    );
    const direction = DEFAULT_ROLES.school.find((r) => r.name === "Direction");
    expect(direction?.permissions).not.toContain("learners.health.write");
    expect(DEFAULT_ROLES.tutoring.map((r) => r.name)).toEqual([
      "Responsable",
      "Prof",
      "Élève",
    ]);
  });
});
