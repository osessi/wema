import { randomUUID } from "node:crypto";
import { createEventStore } from "@wema/db";
import { asEventId, asLearnerId, asNotionId } from "@wema/domain";
import { describe, expect, it } from "vitest";
import { runFollowUp } from "./followup";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

async function setup() {
  const server = await testServer();
  const admin = browser(server.app);
  await admin.post("/auth/login", ADMIN);
  const countryId = text(
    (
      await admin.post("/admin/curriculum/countries", {
        code: "FR",
        name: "France",
        unitLabel: { singular: "C", plural: "C" },
      })
    ).json,
    "id",
  );
  const subjectId = text(
    (
      await admin.post("/admin/curriculum/subjects", {
        code: "maths",
        name: "Maths",
      })
    ).json,
    "id",
  );
  const gradeId = text(
    (
      await admin.post(`/admin/curriculum/countries/${countryId}/grades`, {
        name: "4e",
        position: 0,
      })
    ).json,
    "id",
  );
  const programId = text(
    (await admin.post("/admin/curriculum/programs", { gradeId, subjectId }))
      .json,
    "id",
  );
  const unitId = text(
    (
      await admin.post("/admin/curriculum/units", {
        programId,
        name: "U",
        description: "",
        position: 0,
      })
    ).json,
    "id",
  );
  const notionId = text(
    (
      await admin.post("/admin/curriculum/notions", {
        unitId,
        code: "eq",
        name: "Équations",
        description: "E",
        position: 0,
      })
    ).json,
    "id",
  );
  const learner = browser(server.app);
  await learner.post("/auth/register", {
    displayName: "Élève",
    email: "eleve@example.test",
    password: "mot-de-passe-eleve",
  });
  const learnerId = asLearnerId(
    text((await learner.get("/auth/me")).json, "user", "id"),
  );
  // Une réponse fausse il y a trois jours, puis plus rien.
  await createEventStore(server.db).append({
    id: asEventId(randomUUID()),
    learnerId,
    occurredAt: new Date("2026-10-29T10:00:00Z"),
    source: "web",
    payload: {
      type: "answer.submitted",
      notionId: asNotionId(notionId),
      correct: false,
      hintsUsed: 0,
      misconceptionId: null,
      exerciseRef: null,
      response: "x = 2",
      scaffolded: null,
      misconceptionSource: null,
      misconceptionConfidence: null,
    },
  });
  return { ...server, admin, learner, learnerId, notionId };
}

describe("suivi actif", () => {
  it("prochaines actions de l'élève, avec le nom des notions", async () => {
    const { learner } = await setup();
    const res = await learner.get("/learner/next");
    const actions = field(res.json, "actions");
    expect(
      Array.isArray(actions) &&
        actions.map((a: unknown) => [
          field(a, "kind"),
          field(a, "notionName") ?? null,
        ]),
    ).toEqual([
      ["practice", "Équations"],
      ["intake", null],
    ]);
  });

  it("une relance par jour après deux jours d'inactivité, que l'élève lit", async () => {
    const { db, ai, learner } = await setup();
    const now = new Date("2026-11-01T09:00:00Z");
    expect(await runFollowUp(db, ai, now)).toEqual({ checked: 1, created: 1 });
    expect(await runFollowUp(db, ai, new Date("2026-11-01T15:00:00Z"))).toEqual(
      { checked: 1, created: 0 },
    );
    const list = field((await learner.get("/learner/nudges")).json, "nudges");
    const nudge = Array.isArray(list) ? list[0] : null;
    expect(field(nudge, "reason")).toBe("practice");
    expect(field(nudge, "status")).toBe("ready");
    expect(
      (await learner.post(`/learner/nudges/${text(nudge, "id")}/read`)).status,
    ).toBe(200);
  });

  it("pas de relance si l'élève a travaillé récemment", async () => {
    const { db, ai } = await setup();
    expect(await runFollowUp(db, ai, new Date("2026-10-30T09:00:00Z"))).toEqual(
      { checked: 1, created: 0 },
    );
  });

  it("un élève ne marque pas la relance d'un autre", async () => {
    const { db, ai, app } = await setup();
    await runFollowUp(db, ai, new Date("2026-11-01T09:00:00Z"));
    const other = browser(app);
    await other.post("/auth/register", {
      displayName: "Autre",
      email: "autre@example.test",
      password: "mot-de-passe-autre",
    });
    expect(
      (await other.post(`/learner/nudges/${randomUUID()}/read`)).status,
    ).toBe(404);
  });
});
