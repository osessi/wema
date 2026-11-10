import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

const PASSWORD = "mot-de-passe-de-test-1";

/**
 * Famille : Parent suit Enfant. Conseillère : membre de la plateforme avec
 * « diagnostic.conduct », disponible tous les jours de 8 h à 20 h UTC.
 */
async function setup() {
  const server = await testServer();
  const admin = browser(server.app);
  await admin.post("/auth/login", ADMIN);
  const id = async (res: Promise<{ json: unknown }>, key = "id") =>
    text((await res).json, key);
  const countryId = await id(
    admin.post("/admin/curriculum/countries", {
      code: "FR",
      name: "France",
      unitLabel: { singular: "C", plural: "C" },
    }),
  );
  const subjectId = await id(
    admin.post("/admin/curriculum/subjects", { code: "maths", name: "Maths" }),
  );
  const role = (orgId: string, name: string, permissions: string[]) =>
    id(
      admin.post(`/admin/organizations/${orgId}/roles`, { name, permissions }),
    );
  const member = (orgId: string, roleId: string, name: string, email: string) =>
    id(
      admin.post(`/admin/organizations/${orgId}/members`, {
        displayName: name,
        roleId,
        login: { kind: "email", email, password: PASSWORD },
      }),
      "userId",
    );
  const family = await id(
    admin.post("/admin/organizations", { name: "Famille", kind: "family" }),
  );
  const parentRole = await role(family, "Parent", [
    "learners.read",
    "members.manage",
  ]);
  const childRole = await role(family, "Enfant", []);
  const parent = await member(family, parentRole, "Parent", "p@example.test");
  const child = await member(family, childRole, "Enfant", "e@example.test");
  await admin.post(`/admin/organizations/${family}/guardianships`, {
    guardianId: parent,
    learnerId: child,
  });
  const other = await id(
    admin.post("/admin/organizations", { name: "Autre", kind: "family" }),
  );
  await member(
    other,
    await role(other, "Parent", ["learners.read"]),
    "Autre",
    "autre@example.test",
  );
  const advisorRole = await role(server.platformId, "Conseiller Wema", [
    "diagnostic.conduct",
  ]);
  await member(
    server.platformId,
    advisorRole,
    "Conseillère",
    "conseil@example.test",
  );

  const login = async (email: string) => {
    const b = browser(server.app);
    await b.post("/auth/login", { email, password: PASSWORD });
    return b;
  };
  const advisor = await login("conseil@example.test");
  await advisor.post("/agenda/availability", {
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    startTime: "08:00",
    endTime: "20:00",
    timeZone: "UTC",
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: null,
  });

  /** Abonnement payé en cours (ou essai) pour l'enfant. */
  const subscribe = async (status: "active" | "trialing") => {
    const offerId = randomUUID();
    await server.db.query(
      `INSERT INTO offers (id, country_id, subject_id, currency, amount_minor, methods)
       VALUES ($1, $2, $3, 'EUR', 100, '{card}')`,
      [offerId, countryId, subjectId],
    );
    const later = new Date(Date.now() + 30 * 86_400_000).toISOString();
    await server.db.query(
      `INSERT INTO subscriptions (id, learner_id, subject_id, offer_id, status, trial_ends_at, current_period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        child,
        subjectId,
        offerId,
        status,
        status === "trialing" ? later : null,
        status === "active" ? later : null,
      ],
    );
  };

  return {
    ...server,
    family,
    child,
    subscribe,
    admin,
    advisor,
    parent: await login("p@example.test"),
    learner: await login("e@example.test"),
    stranger: await login("autre@example.test"),
  };
}

const range = () => {
  const from = new Date();
  const to = new Date(from.getTime() + 7 * 86_400_000);
  return `from=${from.toISOString()}&to=${to.toISOString()}`;
};

const firstSlot = async (
  s: Awaited<ReturnType<typeof setup>>,
): Promise<string> => {
  const res = await s.parent.get(
    `/diagnostic/slots?learnerId=${s.child}&${range()}`,
  );
  expect(res.status).toBe(200);
  const slots = field(res.json, "slots");
  if (!Array.isArray(slots) || slots.length === 0)
    throw new Error("aucun créneau");
  return text(slots[0], "start");
};

describe("rendez-vous de diagnostic", () => {
  it("n'est ouvert qu'après le paiement (un essai ne suffit pas)", async () => {
    const s = await setup();
    const family = await s.parent.get("/diagnostic/family");
    expect(field(family.json, "children", "0", "eligibility")).toEqual({
      eligible: false,
      reason: "no_paid_subscription",
    });
    await s.subscribe("trialing");
    const slots = await s.parent.get(
      `/diagnostic/slots?learnerId=${s.child}&${range()}`,
    );
    expect(slots.status).toBe(409);
  });

  it("le parent réserve un créneau de 15 minutes, une seule fois ; il peut annuler et reprendre", async () => {
    const s = await setup();
    await s.subscribe("active");
    const start = await firstSlot(s);
    expect(
      (
        await s.stranger.post("/diagnostic/bookings", {
          learnerId: s.child,
          startsAt: start,
        })
      ).status,
    ).toBe(403);
    const booked = await s.parent.post("/diagnostic/bookings", {
      learnerId: s.child,
      startsAt: start,
    });
    expect(booked.status).toBe(201);
    const again = await s.parent.post("/diagnostic/bookings", {
      learnerId: s.child,
      startsAt: start,
    });
    expect(again.status).toBe(409);
    const family = await s.parent.get("/diagnostic/family");
    const appointment = field(family.json, "children", "0", "appointment");
    expect(field(appointment, "status")).toBe("booked");
    const startsAt = new Date(text(appointment, "startsAt"));
    const endsAt = new Date(text(appointment, "endsAt"));
    expect(endsAt.getTime() - startsAt.getTime()).toBe(15 * 60_000);
    expect(String(field(appointment, "visioUrl"))).toMatch(/^https:\/\//);

    // Le créneau pris n'est plus proposé.
    const next = await firstSlot(s).catch(() => null);
    expect(next).toBeNull(); // déjà réservé : plus de créneau pour cet enfant

    const cancel = await s.parent.post(
      `/diagnostic/${text(booked.json, "id")}/cancel`,
    );
    expect(cancel.status).toBe(200);
    expect(await firstSlot(s)).toBe(start);
  });

  it("l'espace conseiller est réservé à « diagnostic.conduct »", async () => {
    const s = await setup();
    expect((await s.parent.get("/diagnostic/advisor")).status).toBe(403);
    expect((await s.advisor.get("/diagnostic/advisor")).status).toBe(200);
  });

  it("le compte rendu alimente le profil par un événement, visible du parent et pas de l'élève ; jamais de santé", async () => {
    const s = await setup();
    await s.subscribe("active");
    const booked = await s.parent.post("/diagnostic/bookings", {
      learnerId: s.child,
      startsAt: await firstSlot(s),
    });
    const id = text(booked.json, "id");
    const list = await s.advisor.get("/diagnostic/advisor");
    expect(field(list.json, "appointments", "0", "learnerName")).toBe("Enfant");

    const sheet = {
      since: "Depuis la rentrée",
      where: "Les fractions",
      blockers: "N'ose pas demander",
      motivation: "Veut progresser",
      learningStyle: "Aime les exemples concrets",
      needs: "",
    };
    const health = await s.advisor.put(`/diagnostic/advisor/${id}`, {
      sheet: { ...sheet, needs: "Peut-être une dyslexie" },
      hypotheses: [],
      notes: "",
    });
    expect(health.status).toBe(422);
    expect(field(health.json, "error", "code")).toBe("health_term");

    const saved = await s.advisor.put(`/diagnostic/advisor/${id}`, {
      sheet,
      hypotheses: [
        { key: "format.examples", label: null, value: true, confidence: 0.9 },
      ],
      notes: "Rappeler dans un mois",
    });
    expect(saved.status).toBe(200);
    // Pas avant le rendez-vous.
    expect(
      (await s.advisor.post(`/diagnostic/advisor/${id}/report`)).status,
    ).toBe(409);
    await s.db.query(
      "UPDATE diagnostic_appointments SET starts_at = now() - interval '1 hour', ends_at = now() - interval '45 minutes' WHERE id = $1",
      [id],
    );
    const report = await s.advisor.post(`/diagnostic/advisor/${id}/report`);
    expect(report.status).toBe(200);
    expect(
      (await s.advisor.post(`/diagnostic/advisor/${id}/report`)).status,
    ).toBe(409);

    const { rows } = await s.db.query<{ source: string; type: string }>(
      "SELECT source, type FROM learning_events WHERE learner_id = $1",
      [s.child],
    );
    expect(rows).toEqual([{ source: "advisor", type: "diagnostic.reported" }]);

    const profile = await s.parent.get(
      `/admin/organizations/${s.family}/learners/${s.child}/profile`,
    );
    expect(profile.status).toBe(200);
    expect(field(profile.json, "hypotheses", "0")).toMatchObject({
      key: "format.examples",
      sources: ["diagnostic"],
      confidence: 0.5,
    });
    expect(field(profile.json, "diagnostics", "0", "sheet")).toEqual(sheet);
    // Les notes de travail du conseiller ne sortent pas.
    expect(JSON.stringify(profile.json)).not.toContain("Rappeler");
    const own = await s.learner.get("/learner/profile");
    expect(field(own.json, "diagnostics")).toBeUndefined();

    const family = await s.parent.get("/diagnostic/family");
    expect(field(family.json, "children", "0", "eligibility")).toEqual({
      eligible: false,
      reason: "already_done",
    });
  });
});

describe("premiers pas", () => {
  it("l'élève voit ce qui reste à faire ; le parent, les étapes de chaque enfant", async () => {
    const s = await setup();
    expect((await s.learner.get("/onboarding/learner")).json).toEqual({
      placementDone: false,
      intakeDone: false,
    });
    const family = await s.parent.get("/onboarding/family");
    expect(field(family.json, "hasFamily")).toBe(true);
    expect(field(family.json, "children", "0")).toMatchObject({
      displayName: "Enfant",
      hasProgram: false,
      placementDone: false,
      access: null,
      diagnostic: { status: null },
    });
    await s.subscribe("active");
    const after = await s.parent.get("/onboarding/family");
    expect(field(after.json, "children", "0", "access")).toBe("subscription");
    expect(
      field(after.json, "children", "0", "diagnostic", "eligibility"),
    ).toEqual({ eligible: true });
  });
});
