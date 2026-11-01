import {
  asOrganizationId,
  asRoleId,
  asUserId,
  type Membership,
  type OrganizationKind,
  type Permission,
} from "@wema/domain";
import { describe, expect, it } from "vitest";
import { can, effectivePermissions } from "./index";

const user = asUserId("00000000-0000-4000-8000-000000000001");
const wema = asOrganizationId("00000000-0000-4000-8000-0000000000aa");
const school = asOrganizationId("00000000-0000-4000-8000-0000000000bb");
const otherSchool = asOrganizationId("00000000-0000-4000-8000-0000000000cc");

const member = (
  organizationId: typeof wema,
  organizationKind: OrganizationKind,
  permissions: Permission[],
): Membership => ({
  userId: user,
  organizationId,
  organizationKind,
  roleId: asRoleId("r"),
  permissions,
});

describe("can", () => {
  it("un admin d'école ne modifie pas le référentiel, même avec la permission", () => {
    const m = [
      member(school, "school", ["curriculum.write", "members.manage"]),
    ];
    expect(can(m, "curriculum.write")).toBe(false);
    expect(can(m, "members.manage", school)).toBe(true);
  });

  it("une permission d'organisation ne déborde pas sur une autre organisation", () => {
    const m = [member(school, "school", ["members.manage"])];
    expect(can(m, "members.manage", otherSchool)).toBe(false);
  });

  it("l'équipe Wema agit sur la plateforme et sur toutes les organisations", () => {
    const m = [
      member(wema, "platform", ["curriculum.write", "members.manage"]),
    ];
    expect(can(m, "curriculum.write")).toBe(true);
    expect(can(m, "members.manage", otherSchool)).toBe(true);
    expect(can(m, "roles.manage", school)).toBe(false);
  });

  it("les permissions de plusieurs rôles s'additionnent", () => {
    const m = [
      member(school, "school", ["audit.read"]),
      member(wema, "platform", ["curriculum.read"]),
    ];
    expect(effectivePermissions(m, school)).toEqual([
      "curriculum.read",
      "audit.read",
    ]);
  });
});
