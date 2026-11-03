import type { AiProvider } from "@wema/ai-gateway";
import { err, ok } from "@wema/domain";
import type { MathVerifier } from "@wema/exercises";
import { describe, expect, it } from "vitest";
import { runWeeklyBank } from "./routes/exercises";
import {
  ADMIN,
  browser,
  fakeAiProvider,
  fakeMath,
  field,
  testServer,
  text,
} from "./test-helpers";

// Droits et règles des exercices, avec le faux services/math (le vrai est
// testé dans exercises-math.test.ts).

const equation = {
  objective: "Résoudre une équation",
  misconceptionId: null,
  statement: "Résous {equation}.",
  task: { kind: "solve", equation: "a*x + b = c", variable: "x" },
  parameters: [{ name: "a", ranges: [{ min: 2, max: 5 }], exclude: [] }],
  constraints: [],
  steps: [],
  expected: "x = 1",
};

async function setup(
  aiProvider: AiProvider = fakeAiProvider,
  math: MathVerifier = fakeMath,
) {
  const server = await testServer({}, math, aiProvider);
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
        name: "Eq",
        description: "E",
        position: 0,
      })
    ).json,
    "id",
  );
  const me = text(
    (await admin.get("/auth/me")).json,
    "organizations",
    "0",
    "id",
  );

  const school = async (name: string, n: number) => {
    const id = text(
      (await admin.post("/admin/organizations", { name, kind: "school" })).json,
      "id",
    );
    const prof = text(
      (
        await admin.post(`/admin/organizations/${id}/roles`, {
          name: "Prof",
          permissions: ["exercises.read", "exercises.write", "members.manage"],
        })
      ).json,
      "id",
    );
    const reader = text(
      (
        await admin.post(`/admin/organizations/${id}/roles`, {
          name: "Lecteur",
          permissions: ["exercises.read"],
        })
      ).json,
      "id",
    );
    const pupilRole = text(
      (
        await admin.post(`/admin/organizations/${id}/roles`, {
          name: "Élève",
          permissions: [],
        })
      ).json,
      "id",
    );
    const add = (displayName: string, roleId: string, login: unknown) =>
      admin.post(`/admin/organizations/${id}/members`, {
        displayName,
        roleId,
        login,
      });
    await add("Prof", prof, {
      kind: "email",
      email: `prof${n}@example.test`,
      password: "mot-de-passe-prof",
    });
    await add("Lecteur", reader, {
      kind: "email",
      email: `lecteur${n}@example.test`,
      password: "mot-de-passe-lect",
    });
    const pupil = await add("Élève", pupilRole, {
      kind: "username",
      username: `eleve.${n}`,
    });
    const teacher = browser(server.app);
    await teacher.post("/auth/login", {
      email: `prof${n}@example.test`,
      password: "mot-de-passe-prof",
    });
    const readerSession = browser(server.app);
    await readerSession.post("/auth/login", {
      email: `lecteur${n}@example.test`,
      password: "mot-de-passe-lect",
    });
    const learner = browser(server.app);
    await learner.post("/auth/learner", {
      username: `eleve.${n}`,
      code: text(pupil.json, "loginCode"),
    });
    return {
      id,
      teacher,
      reader: readerSession,
      learner,
      pupilId: text(pupil.json, "userId"),
    };
  };
  const a = await school("École A", 1);
  const b = await school("École B", 2);
  return { ...server, admin, notionId, programId, platformId: me, a, b };
}

async function validatedIntent(
  s: Awaited<ReturnType<typeof setup>>["a"],
  notionId: string,
) {
  const id = text(
    (
      await s.teacher.post(`/admin/organizations/${s.id}/exercises`, {
        ...equation,
        notionId,
      })
    ).json,
    "id",
  );
  expect((await s.teacher.post(`/admin/exercises/${id}/validate`)).status).toBe(
    200,
  );
  return id;
}

describe("droits sur les exercices", () => {
  it("un prof de l'école A n'agit pas sur les exercices, la banque ni les élèves de l'école B", async () => {
    const { a, b, notionId } = await setup();
    const intentB = await validatedIntent(b, notionId);
    expect(
      (
        await a.teacher.patch(`/admin/exercises/${intentB}`, {
          ...equation,
          notionId,
        })
      ).status,
    ).toBe(403);
    expect(
      (await a.teacher.post(`/admin/exercises/${intentB}/validate`)).status,
    ).toBe(403);
    expect(
      (
        await a.teacher.post(
          `/admin/organizations/${a.id}/exercises/${intentB}/preview`,
          { level: 1, scaffolded: false },
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await a.teacher.post(
          `/admin/organizations/${b.id}/exercises/${intentB}/variants`,
          { learnerIds: [b.pupilId] },
        )
      ).status,
    ).toBe(403);

    const intentA = await validatedIntent(a, notionId);
    const generated = await a.teacher.post(
      `/admin/organizations/${a.id}/exercises/${intentA}/variants`,
      { learnerIds: [b.pupilId] },
    );
    expect(field(generated.json, "failed")).toEqual([
      { learnerId: b.pupilId, error: "not_member" },
    ]);

    const week = "2026-11-02";
    const entry = text(
      (
        await b.teacher.post(`/admin/organizations/${b.id}/bank`, {
          week,
          intentId: intentB,
        })
      ).json,
      "id",
    );
    expect(
      (
        await a.teacher.patch(`/admin/organizations/${a.id}/bank/${entry}`, {
          status: "selected",
        })
      ).status,
    ).toBe(404);
  });

  it("la simple lecture ne donne ni l'aperçu ni la réponse annoncée", async () => {
    const { a, notionId } = await setup();
    const intent = await validatedIntent(a, notionId);
    expect(
      (
        await a.reader.post(
          `/admin/organizations/${a.id}/exercises/${intent}/preview`,
          { level: 1, scaffolded: false },
        )
      ).status,
    ).toBe(403);
    const list = await a.reader.get(`/admin/organizations/${a.id}/exercises`);
    expect(JSON.stringify(list.json)).not.toContain("x = 1");
  });

  it("de la bibliothèque Wema, une école ne voit que les exercices validés", async () => {
    const { admin, a, notionId, platformId } = await setup();
    const draft = text(
      (
        await admin.post(`/admin/organizations/${platformId}/exercises`, {
          ...equation,
          notionId,
          objective: "Brouillon",
        })
      ).json,
      "id",
    );
    const shared = text(
      (
        await admin.post(`/admin/organizations/${platformId}/exercises`, {
          ...equation,
          notionId,
          objective: "Partagé",
        })
      ).json,
      "id",
    );
    await admin.post(`/admin/exercises/${shared}/validate`);
    const list = JSON.stringify(
      (await a.teacher.get(`/admin/organizations/${a.id}/exercises`)).json,
    );
    expect(list).toContain(shared);
    expect(list).not.toContain(draft);
  });
});

describe("réponses des élèves", () => {
  it("seul le premier essai compte pour le profil, et les essais sont limités", async () => {
    const { a, notionId } = await setup();
    const intent = await validatedIntent(a, notionId);
    await a.teacher.post(
      `/admin/organizations/${a.id}/exercises/${intent}/variants`,
      { learnerIds: [a.pupilId] },
    );
    const variants = field(
      (await a.learner.get("/learner/variants")).json,
      "variants",
    );
    const id = text(Array.isArray(variants) ? variants[0] : null, "id");
    const answer = (response: string) =>
      a.learner.post(`/learner/variants/${id}/answer`, {
        response,
        hintsUsed: 0,
      });

    expect((await answer("???")).status).toBe(422);
    expect(field((await answer("x = 2")).json, "attemptsLeft")).toBe(2);
    expect(field((await answer("x = 1")).json, "correct")).toBe(true);
    expect((await answer("x = 1")).status).toBe(200);
    expect((await answer("x = 1")).status).toBe(409);

    const notions = field(
      (await a.learner.get("/learner/progress")).json,
      "notions",
    );
    // Une seule observation, l'essai faux : refaire la variante ne gonfle pas la maîtrise.
    expect(
      Array.isArray(notions) &&
        notions.map((n: unknown) => field(n, "observations")),
    ).toEqual([1]);
  });

  it("un élève ne fait vérifier qu'une réponse à la fois (services/math n'est pas monopolisé)", async () => {
    // Faux services/math lent : chaque vérification prend 200 ms.
    const slowMath: MathVerifier = {
      ...fakeMath,
      checkAnswer: async (expected, answer) => {
        await new Promise((r) => setTimeout(r, 200));
        return fakeMath.checkAnswer(expected, answer);
      },
    };
    const { a, notionId } = await setup(fakeAiProvider, slowMath);
    const intent = await validatedIntent(a, notionId);
    await a.teacher.post(
      `/admin/organizations/${a.id}/exercises/${intent}/variants`,
      { learnerIds: [a.pupilId] },
    );
    const variants = field(
      (await a.learner.get("/learner/variants")).json,
      "variants",
    );
    const id = text(Array.isArray(variants) ? variants[0] : null, "id");
    const answer = () =>
      a.learner.post(`/learner/variants/${id}/answer`, {
        response: "???",
        hintsUsed: 0,
      });
    // Réponses illisibles (elles ne consomment pas d'essai) envoyées en rafale.
    const burst = await Promise.all(Array.from({ length: 6 }, answer));
    const statuses = burst.map((r) => r.status).sort();
    expect(statuses.filter((x) => x === 422)).toHaveLength(1);
    expect(statuses.filter((x) => x === 429)).toHaveLength(5);
    expect(
      field(burst.find((r) => r.status === 429)?.json, "error", "code"),
    ).toBe("slow_down");
    // Une fois la vérification finie, l'élève peut répondre de nouveau.
    expect((await answer()).status).toBe(422);
  });

  it("un élève ne corrige pas la variante d'un autre élève", async () => {
    const { a, b, notionId } = await setup();
    const intent = await validatedIntent(a, notionId);
    await a.teacher.post(
      `/admin/organizations/${a.id}/exercises/${intent}/variants`,
      { learnerIds: [a.pupilId] },
    );
    const variants = field(
      (await a.learner.get("/learner/variants")).json,
      "variants",
    );
    const id = text(Array.isArray(variants) ? variants[0] : null, "id");
    expect(
      (
        await b.learner.post(`/learner/variants/${id}/answer`, {
          response: "1",
          hintsUsed: 0,
        })
      ).status,
    ).toBe(404);
  });
});

// Banque proposée par l'IA : faux fournisseur, faux services/math.

const proposal = (equation: string, objective: string) => ({
  objective,
  misconceptionId: null,
  statement: "Résous {equation}.",
  task: {
    kind: "solve",
    equation,
    variable: "x",
    expression: null,
    round: null,
  },
  parameters: [{ name: "a", ranges: [{ min: 2, max: 5 }], exclude: [] }],
  constraints: [],
  steps: ["Divise par {a}."],
});

/** Faux fournisseur qui répond toujours le même texte. */
const answering = (text: string): AiProvider => ({
  ...fakeAiProvider,
  generate: async () =>
    ok({
      text,
      model: "test/modele",
      usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
    }),
});

/** services/math qui refuse toute équation contenant « b » (sans solution). */
const pickyMath: MathVerifier = {
  ...fakeMath,
  checkExercise: async (input) =>
    input.task.kind === "solve" && input.task.equation.includes("b")
      ? err({ kind: "check_failed", reason: "no_solution" })
      : fakeMath.checkExercise(input),
};

const WEEK = "2026-11-02";

async function withClass(s: Awaited<ReturnType<typeof setup>>) {
  const classId = text(
    (
      await s.admin.post(`/admin/organizations/${s.a.id}/classes`, {
        name: "4e A",
        programId: s.programId,
      })
    ).json,
    "id",
  );
  await s.admin.post(`/admin/classes/${classId}/members`, {
    userId: s.a.pupilId,
    role: "learner",
  });
  return classId;
}

describe("banque proposée par l'IA", () => {
  it("seul un prof qui écrit des exercices dans l'organisation la déclenche", async () => {
    const s = await setup(
      answering(
        JSON.stringify({ proposals: [proposal("a*x = a", "Diviser")] }),
      ),
    );
    await withClass(s);
    const path = `/admin/organizations/${s.a.id}/bank/generate`;
    expect((await s.a.reader.post(path, { week: WEEK })).status).toBe(403);
    expect((await s.b.teacher.post(path, { week: WEEK })).status).toBe(403);
    expect((await s.a.teacher.post(path, { week: "2026-11-03" })).status).toBe(
      400,
    );
  });

  it("les propositions vérifiées entrent dans la banque, validées et signées « ai » ; retenues, elles se donnent aux élèves", async () => {
    const s = await setup(
      answering(
        JSON.stringify({
          proposals: [
            proposal("a*x = a", "Diviser"),
            proposal("a*x + b = a", "Refusée par le calcul"),
            { ...proposal("x = a", "Mal formée"), parameters: [] },
          ],
        }),
      ),
      pickyMath,
    );
    await withClass(s);
    const res = await s.a.teacher.post(
      `/admin/organizations/${s.a.id}/bank/generate`,
      { week: WEEK },
    );
    expect(res.status).toBe(200);
    const proposed = field(res.json, "proposed");
    const rejected = field(res.json, "rejected");
    expect(Array.isArray(proposed) && proposed.length).toBe(1);
    expect(
      Array.isArray(rejected) &&
        rejected.map((r: unknown) => [
          field(r, "objective"),
          field(r, "reason"),
        ]),
    ).toEqual([
      ["Refusée par le calcul", "check_failed"],
      ["Mal formée", "invalid_format"],
    ]);

    const entries = field(
      (
        await s.a.teacher.get(
          `/admin/organizations/${s.a.id}/bank?week=${WEEK}`,
        )
      ).json,
      "entries",
    );
    const entry = Array.isArray(entries) ? entries[0] : null;
    expect(field(entry, "status")).toBe("proposed");
    const intentId = text(entry, "intentId");
    const list = field(
      (await s.a.teacher.get(`/admin/organizations/${s.a.id}/exercises`)).json,
      "exercises",
    );
    const intent = Array.isArray(list)
      ? list.find((x: unknown) => field(x, "id") === intentId)
      : null;
    expect(field(intent, "source")).toBe("ai");
    expect(field(intent, "status")).toBe("validated");
    expect(field(intent, "expected")).toBeNull();

    // Retenue, elle se donne comme les autres : une variante vérifiée par élève.
    expect(
      (
        await s.a.teacher.patch(
          `/admin/organizations/${s.a.id}/bank/${text(entry, "id")}`,
          { status: "selected" },
        )
      ).status,
    ).toBe(200);
    const variants = await s.a.teacher.post(
      `/admin/organizations/${s.a.id}/exercises/${intentId}/variants`,
      { learnerIds: [s.a.pupilId] },
    );
    const created = field(variants.json, "created");
    expect(Array.isArray(created) && created.length).toBe(1);
  });

  it("une sortie de l'IA illisible ne fait rien entrer et répond « IA indisponible »", async () => {
    const s = await setup(answering("pas du JSON"));
    await withClass(s);
    const res = await s.a.teacher.post(
      `/admin/organizations/${s.a.id}/bank/generate`,
      { week: WEEK },
    );
    expect(res.status).toBe(503);
    expect(field(res.json, "error", "code")).toBe("ai_unavailable");
    expect(
      field(
        (
          await s.a.teacher.get(
            `/admin/organizations/${s.a.id}/bank?week=${WEEK}`,
          )
        ).json,
        "entries",
      ),
    ).toEqual([]);
  });

  it("le passage automatique ne prépare chaque organisation qu'une fois par semaine", async () => {
    let calls = 0;
    const provider = answering(
      JSON.stringify({ proposals: [proposal("a*x = a", "Diviser")] }),
    );
    const s = await setup({
      ...provider,
      generate: (r) => {
        calls++;
        return provider.generate(r);
      },
    });
    await withClass(s);
    const deps = { db: s.db, ai: s.ai, math: fakeMath };
    const monday = new Date("2026-11-02T08:00:00Z");
    const first = await runWeeklyBank(deps, monday);
    expect(first).toEqual({ week: WEEK, organizations: 1, proposed: 1 });
    expect(calls).toBe(1);
    const again = await runWeeklyBank(deps, new Date("2026-11-05T08:00:00Z"));
    expect(again.organizations).toBe(0);
    expect(calls).toBe(1);
  });

  it("sans classe avec un programme, rien n'est demandé à l'IA", async () => {
    const s = await setup();
    const res = await s.a.teacher.post(
      `/admin/organizations/${s.a.id}/bank/generate`,
      { week: WEEK },
    );
    expect(res.status).toBe(200);
    expect(field(res.json, "notions")).toBe(0);
  });
});
