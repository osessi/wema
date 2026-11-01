import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCurriculumSeed } from "@wema/curriculum";
import { createCurriculumStore, createExerciseStore } from "@wema/db";
import { asExerciseVariantId } from "@wema/domain";
import { createHttpMathVerifier, loadExerciseSeed } from "@wema/exercises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importExampleExercises } from "./seed-exercises";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

// Boucle complète avec le vrai services/math (Python + SymPy) : exercice,
// validation, variante par élève, correction, profil recalculé.

const mathDir = fileURLToPath(
  new URL("../../../services/math", import.meta.url),
);
const localUv = join(homedir(), ".local", "bin", "uv");
const uv = existsSync(localUv) ? localUv : "uv";
const port = 8765 + Math.floor(Math.random() * 200);
const mathUrl = `http://127.0.0.1:${port}`;
let mathProcess: ChildProcess | undefined;

beforeAll(async () => {
  mathProcess = spawn(
    uv,
    ["run", "--locked", "uvicorn", "wema_math.app:app", "--port", String(port)],
    {
      cwd: mathDir,
      stdio: "ignore",
    },
  );
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${mathUrl}/health`)).ok) return;
    } catch {
      // pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("services/math n'a pas démarré");
}, 30_000);

afterAll(() => {
  mathProcess?.kill();
});

const equation = {
  objective: "Résoudre une équation du premier degré",
  misconceptionId: null,
  statement: "Résous l'équation {equation}.",
  task: { kind: "solve", equation: "a*x + b = c", variable: "x" },
  parameters: [
    {
      name: "a",
      ranges: [
        { min: 2, max: 5 },
        { min: 3, max: 9 },
        { min: 6, max: 15 },
      ],
      exclude: [],
    },
    {
      name: "b",
      ranges: [
        { min: 1, max: 9 },
        { min: -20, max: 20 },
      ],
      exclude: [0],
    },
    {
      name: "c",
      ranges: [
        { min: 1, max: 40 },
        { min: -40, max: 60 },
      ],
      exclude: [],
    },
  ],
  constraints: ["Eq(Mod(c - b, a), 0)"],
  steps: ["Retire {b} des deux membres.", "Divise les deux membres par {a}."],
  expected: null,
};

async function setup() {
  const server = await testServer({}, createHttpMathVerifier(mathUrl));
  const admin = browser(server.app);
  await admin.post("/auth/login", ADMIN);
  const countryId = text(
    (
      await admin.post("/admin/curriculum/countries", {
        code: "BJ",
        name: "Bénin",
        unitLabel: { singular: "SA", plural: "SA" },
      })
    ).json,
    "id",
  );
  const subjectId = text(
    (
      await admin.post("/admin/curriculum/subjects", {
        code: "maths",
        name: "Mathématiques",
      })
    ).json,
    "id",
  );
  const gradeId = text(
    (
      await admin.post(`/admin/curriculum/countries/${countryId}/grades`, {
        name: "3e",
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
        name: "Équations",
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
        description: "Résoudre ax + b = c",
        position: 0,
      })
    ).json,
    "id",
  );
  const schoolId = text(
    (
      await admin.post("/admin/organizations", {
        name: "École Démo",
        kind: "school",
      })
    ).json,
    "id",
  );
  const teacherRole = text(
    (
      await admin.post(`/admin/organizations/${schoolId}/roles`, {
        name: "Prof",
        permissions: [
          "exercises.read",
          "exercises.write",
          "members.manage",
          "curriculum.read",
        ],
      })
    ).json,
    "id",
  );
  const pupilRole = text(
    (
      await admin.post(`/admin/organizations/${schoolId}/roles`, {
        name: "Élève",
        permissions: [],
      })
    ).json,
    "id",
  );
  await admin.post(`/admin/organizations/${schoolId}/members`, {
    displayName: "Prof Démo",
    roleId: teacherRole,
    login: {
      kind: "email",
      email: "prof@example.test",
      password: "mot-de-passe-prof",
    },
  });
  const pupil = await admin.post(`/admin/organizations/${schoolId}/members`, {
    displayName: "Élève Démo",
    roleId: pupilRole,
    login: { kind: "username", username: "eleve.demo" },
  });
  const teacher = browser(server.app);
  await teacher.post("/auth/login", {
    email: "prof@example.test",
    password: "mot-de-passe-prof",
  });
  const learner = browser(server.app);
  await learner.post("/auth/learner", {
    username: "eleve.demo",
    code: text(pupil.json, "loginCode"),
  });
  return {
    ...server,
    teacher,
    learner,
    schoolId,
    notionId,
    pupilId: text(pupil.json, "userId"),
  };
}

describe("exercices avec le vrai services/math", () => {
  it("de l'exercice du prof à la maîtrise de l'élève", async () => {
    const { db, teacher, learner, schoolId, notionId, pupilId } = await setup();

    const intentId = text(
      (
        await teacher.post(`/admin/organizations/${schoolId}/exercises`, {
          ...equation,
          notionId,
        })
      ).json,
      "id",
    );
    expect(
      (
        await teacher.post(
          `/admin/organizations/${schoolId}/exercises/${intentId}/variants`,
          { learnerIds: [pupilId] },
        )
      ).status,
    ).toBe(422);
    const validated = await teacher.post(
      `/admin/exercises/${intentId}/validate`,
    );
    expect(validated.status).toBe(200);

    const generated = await teacher.post(
      `/admin/organizations/${schoolId}/exercises/${intentId}/variants`,
      { learnerIds: [pupilId] },
    );
    const created = field(generated.json, "created");
    expect(Array.isArray(created) && created.length).toBe(1);
    // Jamais vue : nombres simples et étapes guidées.
    expect(
      field(Array.isArray(created) ? created[0] : null, "scaffolded"),
    ).toBe(true);

    const mine = await learner.get("/learner/variants");
    const variants = field(mine.json, "variants");
    const first = Array.isArray(variants) ? variants[0] : null;
    expect(text(first, "statement")).toMatch(
      /^Résous l'équation \d+x \+ \d+ = \d+\.$/,
    );
    expect(JSON.stringify(mine.json)).not.toContain("answer");

    const variant = await createExerciseStore(db).getVariant(
      asExerciseVariantId(text(first, "id")),
    );
    const solution =
      variant?.answer.kind === "solutions"
        ? variant.answer.values[0]
        : undefined;
    if (!solution) throw new Error("variante sans solution");

    const wrong = await learner.post(
      `/learner/variants/${text(first, "id")}/answer`,
      { response: `x = ${Number(solution) + 1}`, hintsUsed: 0 },
    );
    expect(field(wrong.json, "correct")).toBe(false);
    expect(JSON.stringify(wrong.json)).not.toContain(`"${solution}"`);
    const right = await learner.post(
      `/learner/variants/${text(first, "id")}/answer`,
      { response: `x=${solution}`, hintsUsed: 1 },
    );
    expect(field(right.json, "correct")).toBe(true);

    const progress = await learner.get("/learner/progress");
    const notions = field(progress.json, "notions");
    expect(
      Array.isArray(notions) &&
        notions.map((n: unknown) => field(n, "observations")),
    ).toEqual([2]);
    expect(Array.isArray(notions) && field(notions[0], "notionId")).toBe(
      notionId,
    );
  }, 60_000);

  it("refuse de valider un exercice dont la réponse annoncée est fausse", async () => {
    const { teacher, schoolId, notionId } = await setup();
    const intentId = text(
      (
        await teacher.post(`/admin/organizations/${schoolId}/exercises`, {
          ...equation,
          notionId,
          task: { kind: "expand", expression: "a*(x + b)" },
          statement: "Développe {expression}.",
          steps: [],
          constraints: [],
          expected: "a*x + b",
        })
      ).json,
      "id",
    );
    const res = await teacher.post(`/admin/exercises/${intentId}/validate`);
    expect(res.status).toBe(422);
    expect(field(res.json, "error", "details", "reason")).toBe("mismatch");
  }, 60_000);

  it("un élève ne voit ni ne corrige la variante d'un autre", async () => {
    const { app, learner } = await setup();
    const other = browser(app);
    await other.post("/auth/register", {
      displayName: "Autre",
      email: "autre@example.test",
      password: "mot-de-passe-autre",
    });
    const mine = await learner.get("/learner/variants");
    expect(field(mine.json, "variants")).toEqual([]);
    const res = await other.post(
      "/learner/variants/00000000-0000-4000-8000-000000000001/answer",
      { response: "1", hintsUsed: 0 },
    );
    expect(res.status).toBe(404);
  }, 60_000);

  it("tous les exercices d'exemple du dépôt sont validés par services/math", async () => {
    const { db } = await testServer({}, createHttpMathVerifier(mathUrl));
    const content = fileURLToPath(new URL("../../../content", import.meta.url));
    const curriculum = await loadCurriculumSeed(join(content, "curriculum"));
    const exercises = await loadExerciseSeed(join(content, "exercises"));
    if (!curriculum.ok || !exercises.ok)
      throw new Error("jeu d'exemple illisible");
    for (const country of curriculum.value)
      await createCurriculumStore(db).importCountry(country);
    const report = await importExampleExercises(
      db,
      exercises.value,
      createHttpMathVerifier(mathUrl),
    );
    expect(report.problems).toEqual([]);
    expect(report.validated).toBe(exercises.value.length);
    const again = await importExampleExercises(
      db,
      exercises.value,
      createHttpMathVerifier(mathUrl),
    );
    expect(again).toMatchObject({
      created: 0,
      skipped: exercises.value.length,
      validated: 0,
    });
  }, 120_000);
});
