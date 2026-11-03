import type { AiProvider, ProviderRequest } from "@wema/ai-gateway";
import { createEventStore } from "@wema/db";
import { asLearnerId, ok } from "@wema/domain";
import { describe, expect, it } from "vitest";
import { ADMIN, browser, field, testServer, text, WEB } from "./test-helpers";

const usage = { inputTokens: 1, outputTokens: 1, costUsd: 0 };

/** Faux fournisseur d'IA : réponses prévues dans l'ordre ; requêtes gardées. */
function scripted(answers: string[], seen: ProviderRequest[] = []): AiProvider {
  return {
    name: "openrouter",
    generate: async (r) => {
      seen.push(r);
      return ok({ text: answers.shift() ?? "Et ensuite ?", model: "m", usage });
    },
    stream: async (r, onDelta) => {
      seen.push(r);
      const t = answers.shift() ?? "Et ensuite ?";
      onDelta(t);
      return ok({ text: t, model: "m", usage });
    },
  };
}

async function setup(answers: string[], seen: ProviderRequest[] = []) {
  const server = await testServer({}, undefined, scripted(answers, seen));
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
        name: "Mathématiques",
      })
    ).json,
    "id",
  );
  await admin.put(`/admin/curriculum/subjects/${subjectId}/tutor`, {
    instructions: "Appuie-toi sur des schémas.",
  });
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
        description: "Résoudre ax + b = c.",
        position: 0,
      })
    ).json,
    "id",
  );
  const misconceptionId = text(
    (
      await admin.post(`/admin/curriculum/notions/${notionId}/misconceptions`, {
        description: "Change le signe sans opérer des deux côtés.",
      })
    ).json,
    "id",
  );
  const learner = browser(server.app);
  await learner.post("/auth/register", {
    displayName: "Élève Test",
    email: "eleve@example.test",
    password: "mot-de-passe-eleve",
  });
  const learnerId = text((await learner.get("/auth/me")).json, "user", "id");
  return { ...server, admin, learner, learnerId, notionId, misconceptionId };
}

describe("prof IA, côté élève", () => {
  it("question de cours : consignes de la matière, aucune donnée personnelle, messages gardés", async () => {
    const seen: ProviderRequest[] = [];
    const { learner, notionId } = await setup(
      [
        "Imagine une balance : que se passe-t-il si tu ajoutes un poids d'un côté ?",
      ],
      seen,
    );
    const session = await learner.post("/learner/tutor/sessions", {
      mode: "course_question",
      notionId,
    });
    expect(session.status).toBe(201);
    const id = text(session.json, "session", "id");
    const reply = await learner.post(`/learner/tutor/sessions/${id}/messages`, {
      content: "C'est quoi une équation ?",
    });
    expect(text(reply.json, "message", "content")).toContain("balance");
    const system = seen[0]?.messages[0]?.content ?? "";
    expect(system).toContain("Appuie-toi sur des schémas.");
    expect(system).not.toContain("Élève Test");
    const detail = await learner.get(`/learner/tutor/sessions/${id}`);
    const messages = field(detail.json, "messages");
    expect(
      Array.isArray(messages) && messages.map((m: unknown) => field(m, "role")),
    ).toEqual(["learner", "tutor"]);
  });

  it("réponse en flux (SSE) : morceaux, puis le texte final enregistré", async () => {
    const { app, learner, notionId } = await setup([
      "**Imagine** une balance : que se passe-t-il si tu ajoutes un poids ?",
    ]);
    const id = text(
      (
        await learner.post("/learner/tutor/sessions", {
          mode: "course_question",
          notionId,
        })
      ).json,
      "session",
      "id",
    );
    const res = await app.request(
      `/api/learner/tutor/sessions/${id}/messages`,
      {
        method: "POST",
        headers: {
          origin: WEB,
          cookie: learner.cookie(),
          accept: "text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({ content: "C'est quoi une équation ?" }),
      },
    );
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const body = await res.text();
    expect(body).toContain("event: delta");
    const done = body.split("event: done\ndata: ")[1]?.split("\n")[0] ?? "";
    const final: unknown = JSON.parse(done);
    // Le texte final est mis en forme (texte simple) : c'est lui qui fait foi.
    expect(field(final, "content")).toBe(
      "Imagine une balance : que se passe-t-il si tu ajoutes un poids ?",
    );
    expect(field(final, "guarded")).toBe(false);
    const detail = await learner.get(`/learner/tutor/sessions/${id}`);
    const messages = field(detail.json, "messages");
    expect(Array.isArray(messages) && messages.length).toBe(2);
  });

  it("pas d'indice hors de l'aide sur un exercice", async () => {
    const { learner, notionId } = await setup([]);
    const id = text(
      (
        await learner.post("/learner/tutor/sessions", {
          mode: "course_question",
          notionId,
        })
      ).json,
      "session",
      "id",
    );
    const hint = await learner.post(`/learner/tutor/sessions/${id}/hint`);
    expect(hint.status).toBe(422);
    expect(field(hint.json, "error", "code")).toBe("hints_not_available");
  });

  it("« explique-moi » se termine par une évaluation ajoutée au journal, une seule fois", async () => {
    const answers = [
      "D'accord, mais pourquoi on fait pareil des deux côtés ?",
      "Et si on ne le fait que d'un côté ?",
    ];
    const { db, learner, notionId, learnerId, misconceptionId } =
      await setup(answers);
    // L'évaluation de fin de séance (réponse structurée) cite l'idée fausse créée par setup().
    answers.push(
      JSON.stringify({
        understanding: 0.7,
        confidence: 0.8,
        misconceptionIds: [misconceptionId],
        summary: "Justifie l'équilibre.",
      }),
    );
    const id = text(
      (
        await learner.post("/learner/tutor/sessions", {
          mode: "teach_back",
          notionId,
        })
      ).json,
      "session",
      "id",
    );
    await learner.post(`/learner/tutor/sessions/${id}/messages`, {
      content: "On fait la même opération des deux côtés.",
    });
    await learner.post(`/learner/tutor/sessions/${id}/messages`, {
      content: "Pour garder l'égalité, comme une balance.",
    });
    const finished = await learner.post(`/learner/tutor/sessions/${id}/finish`);
    expect(field(finished.json, "assessment")).toEqual({
      understanding: 0.7,
      confidence: 0.8,
    });
    expect(
      (await learner.post(`/learner/tutor/sessions/${id}/finish`)).status,
    ).toBe(409);
    expect(
      (
        await learner.post(`/learner/tutor/sessions/${id}/messages`, {
          content: "Encore ?",
        })
      ).status,
    ).toBe(409);
    const events = await createEventStore(db).listByLearner(
      asLearnerId(learnerId),
    );
    const assessed = events.find(
      (e) => e.payload.type === "teachback.assessed",
    );
    expect(assessed?.payload).toMatchObject({
      understanding: 0.7,
      misconceptionIds: [misconceptionId],
      sessionId: id,
    });
  });

  it("un élève n'accède pas à la séance d'un autre, ni à une variante qui n'est pas la sienne", async () => {
    const { app, learner, notionId } = await setup([]);
    const id = text(
      (
        await learner.post("/learner/tutor/sessions", {
          mode: "course_question",
          notionId,
        })
      ).json,
      "session",
      "id",
    );
    const other = browser(app);
    await other.post("/auth/register", {
      displayName: "Autre",
      email: "autre@example.test",
      password: "mot-de-passe-autre",
    });
    expect((await other.get(`/learner/tutor/sessions/${id}`)).status).toBe(404);
    expect(
      (
        await other.post(`/learner/tutor/sessions/${id}/messages`, {
          content: "Salut",
        })
      ).status,
    ).toBe(404);
    const help = await other.post("/learner/tutor/sessions", {
      mode: "exercise_help",
      variantId: "00000000-0000-4000-8000-000000000001",
    });
    expect(help.status).toBe(404);
    expect(
      (await other.post("/learner/tutor/sessions", { mode: "course_question" }))
        .status,
    ).toBe(422);
  });
});

describe("analyse d'une réponse fausse", () => {
  it("l'idée fausse repérée par l'IA entre dans l'événement de la réponse", async () => {
    const answers: string[] = [];
    const { admin, app, db, notionId, misconceptionId, platformId } =
      await setup(answers);
    const roleId = text(
      (
        await admin.post(`/admin/organizations/${platformId}/roles`, {
          name: "Élève",
          permissions: [],
        })
      ).json,
      "id",
    );
    const pupil = await admin.post(
      `/admin/organizations/${platformId}/members`,
      {
        displayName: "Élève Démo",
        roleId,
        login: { kind: "username", username: "eleve.demo" },
      },
    );
    const intentId = text(
      (
        await admin.post(`/admin/organizations/${platformId}/exercises`, {
          notionId,
          objective: "Résoudre",
          misconceptionId: null,
          statement: "Résous {equation}.",
          task: { kind: "solve", equation: "a*x + b = c", variable: "x" },
          parameters: [
            { name: "a", ranges: [{ min: 2, max: 5 }], exclude: [] },
          ],
          constraints: [],
          steps: [],
          expected: null,
        })
      ).json,
      "id",
    );
    await admin.post(`/admin/exercises/${intentId}/validate`);
    await admin.post(
      `/admin/organizations/${platformId}/exercises/${intentId}/variants`,
      { learnerIds: [text(pupil.json, "userId")] },
    );
    const learner = browser(app);
    await learner.post("/auth/learner", {
      username: "eleve.demo",
      code: text(pupil.json, "loginCode"),
    });
    const variants = field(
      (await learner.get("/learner/variants")).json,
      "variants",
    );
    const variantId = text(Array.isArray(variants) ? variants[0] : null, "id");

    // Aide sur l'exercice : un indice de niveau 1, journalisé.
    answers.push("Que cherche-t-on dans cette équation ?");
    const sessionId = text(
      (
        await learner.post("/learner/tutor/sessions", {
          mode: "exercise_help",
          variantId,
        })
      ).json,
      "session",
      "id",
    );
    const hint = await learner.post(
      `/learner/tutor/sessions/${sessionId}/hint`,
    );
    expect(hint.json).toMatchObject({ level: 1 });

    answers.push(JSON.stringify({ misconceptionId, confidence: 0.85 }));
    const res = await learner.post(`/learner/variants/${variantId}/answer`, {
      response: "x = 13/3",
      hintsUsed: 0,
    });
    expect(field(res.json, "correct")).toBe(false);
    const events = await createEventStore(db).listByLearner(
      asLearnerId(text(pupil.json, "userId")),
    );
    expect(events.map((e) => e.payload.type)).toEqual([
      "hint.requested",
      "answer.submitted",
    ]);
    expect(events[1]?.payload).toMatchObject({
      type: "answer.submitted",
      correct: false,
      misconceptionId,
      misconceptionSource: "ai",
      misconceptionConfidence: 0.85,
    });
  });
});

describe("entretien initial", () => {
  it("conversation sans notion, puis hypothèses ajoutées au journal et visibles dans le profil", async () => {
    const answers = ["Bonjour ! Qu'aimes-tu faire après l'école ?"];
    const { db, learner, learnerId } = await setup(answers);
    const session = await learner.post("/learner/tutor/sessions", {
      mode: "intake",
    });
    expect(session.status).toBe(201);
    const id = text(session.json, "session", "id");
    expect(
      text(
        (
          await learner.post(`/learner/tutor/sessions/${id}/messages`, {
            content: "Le foot !",
          })
        ).json,
        "message",
        "content",
      ),
    ).toContain("école");
    answers.push(
      JSON.stringify({
        hypotheses: [
          { key: "interest", label: "Football", confidence: 0.8 },
          { key: "need.adhd", label: null, confidence: 1 },
        ],
      }),
    );
    const finished = await learner.post(`/learner/tutor/sessions/${id}/finish`);
    expect(field(finished.json, "hypotheses")).toEqual([
      { key: "interest", label: "Football", confidence: 0.8 },
    ]);
    const events = await createEventStore(db).listByLearner(
      asLearnerId(learnerId),
    );
    expect(events.map((e) => e.payload.type)).toEqual(["intake.completed"]);
    const profile = await learner.get("/learner/profile");
    expect(field(profile.json, "hypotheses")).toEqual([
      expect.objectContaining({
        key: "interest:football",
        sources: ["intake"],
        confidence: 0.35,
      }),
    ]);
    expect(field(profile.json, "needs")).toEqual([]);
  });
});
