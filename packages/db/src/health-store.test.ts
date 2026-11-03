import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { asLearnerId } from "@wema/domain";
import { describe, expect, it } from "vitest";
import {
  bootstrapPlatform,
  createAccountStore,
  createHealthStore,
  fromPglite,
  migrate,
} from "./index";

describe("données de santé", () => {
  it("chiffrées en base, consentement du parent, partage et effacement", async () => {
    const db = fromPglite(new PGlite());
    await migrate(db);
    const { platform } = await bootstrapPlatform(db, { superAdmin: null });
    const accounts = createAccountStore(db);
    const learner = await accounts.createUser({
      displayName: "Élève",
      createdBy: null,
    });
    const teacher = await accounts.createUser({
      displayName: "Prof",
      createdBy: null,
    });
    const parent = await accounts.createUser({
      displayName: "Parent",
      createdBy: null,
    });
    const learnerId = asLearnerId(learner.id);
    const health = createHealthStore(db, randomBytes(32));

    const declared = await health.declare({
      learnerId,
      need: "need.dyslexia",
      active: true,
      declaredBy: teacher.id,
      declaredOrg: platform.id,
      role: "teacher",
    });
    expect(declared).toMatchObject({
      need: "need.dyslexia",
      consent: "pending",
    });
    const raw = await db.query<{ need_enc: string }>(
      "SELECT need_enc FROM health_declarations",
    );
    expect(raw.rows[0]?.need_enc).not.toContain("dyslexia");

    expect(
      await health.giveConsent({
        learnerId,
        id: declared?.id ?? "",
        guardian: parent.id,
      }),
    ).toBe(true);
    expect((await health.list(learnerId))[0]).toMatchObject({
      consent: "given",
      consentBy: parent.id,
    });

    await health.share({
      learnerId,
      organizationId: platform.id,
      grantedBy: parent.id,
    });
    expect(await health.sharedWith(learnerId)).toEqual([platform.id]);
    await health.unshare({ learnerId, organizationId: platform.id });
    expect(await health.sharedWith(learnerId)).toEqual([]);

    expect(await health.remove({ learnerId, id: declared?.id ?? "" })).toBe(
      true,
    );
    expect(await health.list(learnerId)).toEqual([]);
  });

  it("une autre clé ne lit rien", async () => {
    const db = fromPglite(new PGlite());
    await migrate(db);
    const { platform } = await bootstrapPlatform(db, { superAdmin: null });
    const user = await createAccountStore(db).createUser({
      displayName: "Élève",
      createdBy: null,
    });
    await createHealthStore(db, randomBytes(32)).declare({
      learnerId: asLearnerId(user.id),
      need: "need.adhd",
      active: true,
      declaredBy: user.id,
      declaredOrg: platform.id,
      role: "guardian",
    });
    await expect(
      createHealthStore(db, randomBytes(32)).list(asLearnerId(user.id)),
    ).rejects.toThrow();
  });
});
