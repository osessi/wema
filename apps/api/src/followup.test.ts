import { randomUUID } from "node:crypto";
import {
  type AiProvider,
  createAiGateway,
  DEFAULT_ROUTING,
} from "@wema/ai-gateway";
import { createEventStore } from "@wema/db";
import { asEventId, asLearnerId, asNotionId, err } from "@wema/domain";
import { NUDGE_FALLBACK } from "@wema/orchestrator";
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
    expect(await runFollowUp(db, ai, now)).toEqual({
      checked: 1,
      created: 1,
      failed: 0,
      skipped: false,
    });
    expect(
      await runFollowUp(db, ai, new Date("2026-11-01T15:00:00Z")),
    ).toMatchObject({ created: 0 });
    const list = field((await learner.get("/learner/nudges")).json, "nudges");
    const nudge = Array.isArray(list) ? list[0] : null;
    expect(field(nudge, "reason")).toBe("practice");
    expect(field(nudge, "status")).toBe("ready");
    // Tant qu'elle n'est pas lue, aucune autre relance, même des jours plus tard.
    expect(
      await runFollowUp(db, ai, new Date("2026-11-10T09:00:00Z")),
    ).toMatchObject({ created: 0 });
    expect(
      (await learner.post(`/learner/nudges/${text(nudge, "id")}/read`)).status,
    ).toBe(200);
    // Lue : la suivante vient 4 jours après la précédente, pas avant.
    expect(
      await runFollowUp(db, ai, new Date("2026-11-04T09:00:00Z")),
    ).toMatchObject({ created: 0 });
    expect(
      await runFollowUp(db, ai, new Date("2026-11-05T10:00:00Z")),
    ).toMatchObject({ created: 1 });
  });

  it("une erreur chez un élève n'arrête pas le passage ; texte de secours si l'IA échoue", async () => {
    const { db, app, notionId } = await setup();
    const other = browser(app);
    await other.post("/auth/register", {
      displayName: "Autre",
      email: "autre@example.test",
      password: "mot-de-passe-autre",
    });
    const otherId = asLearnerId(
      text((await other.get("/auth/me")).json, "user", "id"),
    );
    await createEventStore(db).append({
      id: asEventId(randomUUID()),
      learnerId: otherId,
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
    let calls = 0;
    const flaky: AiProvider = {
      name: "openrouter",
      generate: async () => {
        calls++;
        if (calls === 1) throw new Error("panne imprévue");
        return err({
          kind: "unavailable",
          message: "indisponible",
          retryable: false,
        });
      },
      stream: async () =>
        err({ kind: "unavailable", message: "indisponible", retryable: false }),
    };
    const ai = createAiGateway({
      providers: { openrouter: flaky },
      routing: async () => DEFAULT_ROUTING,
      log: async () => {},
    });
    expect(await runFollowUp(db, ai, new Date("2026-11-01T09:00:00Z"))).toEqual(
      { checked: 2, created: 1, failed: 1, skipped: false },
    );
    const { rows } = await db.query<{ content: string }>(
      "SELECT content FROM nudges",
    );
    expect(rows.map((r) => r.content)).toEqual([NUDGE_FALLBACK.practice]);
  });

  it("pas de relance si l'élève a travaillé récemment", async () => {
    const { db, ai } = await setup();
    // Actif il y a moins de 2 jours : il n'est même pas examiné.
    expect(await runFollowUp(db, ai, new Date("2026-10-30T09:00:00Z"))).toEqual(
      {
        checked: 0,
        created: 0,
        failed: 0,
        skipped: false,
      },
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
