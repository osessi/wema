import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openAccess } from "./billing/access";
import { createDevProvider } from "./billing/dev";
import {
  canBeConfirmed,
  canPay,
  sessionPriceFor,
} from "./billing/session-price";
import { hasSchool } from "./routes/profile";
import { visibleCounts } from "./routes/review";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

const PASSWORD = "mot-de-passe-de-test-1";
const HOUR = 3_600_000;
const DAY = 86_400_000;

describe("règles (sans base)", () => {
  const prices = [
    { countryId: "b", countryName: "Bénin", amountMinor: 5000 },
    { countryId: "f", countryName: "France", amountMinor: 2500 },
  ];

  it("prix d'une séance : pays de l'enfant, réservée par le parent, sinon gratuite", () => {
    expect(sessionPriceFor(prices, ["f"], "guardian")?.amountMinor).toBe(2500);
    expect(sessionPriceFor(prices, ["x"], "guardian")).toBeNull();
    expect(sessionPriceFor([], ["f"], "guardian")).toBeNull();
    expect(sessionPriceFor(prices, ["f"], "self")).toBeNull();
    // Plusieurs pays : le premier par ordre alphabétique, toujours le même.
    expect(sessionPriceFor(prices, ["f", "b"], "guardian")?.countryId).toBe(
      "b",
    );
  });

  it("une séance payante n'est confirmée qu'une fois payée", () => {
    expect(canBeConfirmed(null)).toBe(true);
    expect(canBeConfirmed({ paidAt: null })).toBe(false);
    expect(canBeConfirmed({ paidAt: new Date() })).toBe(true);
    const now = new Date();
    const later = new Date(now.getTime() + HOUR);
    const charge = { paidAt: null };
    expect(canPay({ charge, status: "requested", endsAt: later, now })).toBe(
      true,
    );
    expect(canPay({ charge, status: "proposed", endsAt: later, now })).toBe(
      true,
    );
    expect(canPay({ charge, status: "cancelled", endsAt: later, now })).toBe(
      false,
    );
    expect(canPay({ charge, status: "requested", endsAt: now, now })).toBe(
      false,
    );
    expect(
      canPay({
        charge: { paidAt: now },
        status: "requested",
        endsAt: later,
        now,
      }),
    ).toBe(false);
    expect(
      canPay({ charge: null, status: "requested", endsAt: later, now }),
    ).toBe(false);
  });

  it("partage : seulement si l'enfant appartient à une école", () => {
    expect(hasSchool([])).toBe(false);
    expect(
      hasSchool([
        { organizationKind: "family" },
        { organizationKind: "tutoring" },
      ]),
    ).toBe(false);
    expect(
      hasSchool([
        { organizationKind: "family" },
        { organizationKind: "school" },
      ]),
    ).toBe(true);
  });

  it("compteurs : seulement ce que la personne peut traiter", () => {
    const counts = { toReview: 5, notions: 3, exercises: 2, contacts: 7 };
    expect(
      visibleCounts(counts, {
        curriculum: true,
        exercises: true,
        contacts: true,
      }),
    ).toEqual({ toReview: 5, contacts: 7 });
    expect(
      visibleCounts(counts, {
        curriculum: true,
        exercises: false,
        contacts: false,
      }),
    ).toEqual({ toReview: 3, contacts: null });
    expect(
      visibleCounts(counts, {
        curriculum: false,
        exercises: false,
        contacts: false,
      }),
    ).toEqual({ toReview: null, contacts: null });
  });
});

/**
 * Collège (Prof, Élève Un en 4e A, programme de France) et famille : Parent
 * suit Élève Un. Famille Seule : Parent Seul suit Enfant Seul, sans école.
 */
async function setup() {
  const dev = createDevProvider();
  const server = await testServer(undefined, undefined, undefined, () => ({
    providers: { card: dev, mobile_money: dev },
    stripeWebhookSecret: null,
    kkiapayWebhookSecret: null,
    kkiapay: null,
    access: openAccess,
  }));
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
  const gradeId = await id(
    admin.post(`/admin/curriculum/countries/${countryId}/grades`, {
      name: "4e",
      position: 0,
    }),
  );
  const programId = await id(
    admin.post("/admin/curriculum/programs", { gradeId, subjectId }),
  );
  const unitId = await id(
    admin.post("/admin/curriculum/units", {
      programId,
      name: "U",
      description: "",
      position: 0,
    }),
  );
  const notionId = await id(
    admin.post("/admin/curriculum/notions", {
      unitId,
      code: "fractions",
      name: "Fractions",
      description: "f",
      position: 0,
    }),
  );
  const org = (name: string, kind: string) =>
    id(admin.post("/admin/organizations", { name, kind }));
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
  const school = await org("Collège", "school");
  const direction = await role(school, "Direction", [
    "classes.manage",
    "members.manage",
  ]);
  const profRole = await role(school, "Prof", ["exercises.read"]);
  const pupilRole = await role(school, "Élève", []);
  await member(school, direction, "Direction", "direction@example.test");
  const prof = await member(school, profRole, "Prof", "prof@example.test");
  const pupil = await member(school, pupilRole, "Élève Un", "e1@example.test");

  const parentPerms = ["learners.read", "learners.health.write"];
  const family = await org("Famille", "family");
  const parentRole = await role(family, "Parent", parentPerms);
  const childRole = await role(family, "Enfant", []);
  const parent = await member(family, parentRole, "Parent", "p@example.test");
  await member(family, childRole, "Élève Un", "e1@example.test");
  await admin.post(`/admin/organizations/${family}/guardianships`, {
    guardianId: parent,
    learnerId: pupil,
  });

  const lonely = await org("Famille Seule", "family");
  const lonelyParentRole = await role(lonely, "Parent", parentPerms);
  const lonelyChildRole = await role(lonely, "Enfant", []);
  const lonelyParent = await member(
    lonely,
    lonelyParentRole,
    "Parent Seul",
    "ps@example.test",
  );
  const lonelyChild = await member(
    lonely,
    lonelyChildRole,
    "Enfant Seul",
    "es@example.test",
  );
  await admin.post(`/admin/organizations/${lonely}/guardianships`, {
    guardianId: lonelyParent,
    learnerId: lonelyChild,
  });

  const login = async (email: string) => {
    const b = browser(server.app);
    await b.post("/auth/login", { email, password: PASSWORD });
    return b;
  };
  const dir = await login("direction@example.test");
  const classId = await id(
    dir.post(`/admin/organizations/${school}/classes`, {
      name: "4e A",
      programId,
    }),
  );
  await dir.post(`/admin/classes/${classId}/members`, {
    userId: prof,
    role: "teacher",
  });
  await dir.post(`/admin/classes/${classId}/members`, {
    userId: pupil,
    role: "learner",
  });

  return {
    ...server,
    admin,
    countryId,
    notionId,
    unitId,
    ids: { prof, pupil, parent, family, school, lonely, lonelyChild },
    prof: await login("prof@example.test"),
    parent: await login("p@example.test"),
    lonelyParent: await login("ps@example.test"),
  };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function bookTomorrow(s: Setup) {
  await s.prof.post("/agenda/availability", {
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    startTime: "08:00",
    endTime: "20:00",
    timeZone: "UTC",
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: null,
    everyNWeeks: 1,
    slotMinutes: 60,
  });
  const start = new Date(Date.now() + DAY);
  start.setUTCHours(10, 0, 0, 0);
  return s.parent.post("/agenda/bookings", {
    teacherId: s.ids.prof,
    learnerId: s.ids.pupil,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + HOUR).toISOString(),
    note: null,
  });
}

describe("partage avec les établissements", () => {
  it("masqué et refusé quand l'enfant n'a pas d'école", async () => {
    const s = await setup();
    const base = `/admin/organizations/${s.ids.lonely}/learners/${s.ids.lonelyChild}/health-shares`;
    const res = await s.lonelyParent.get(base);
    expect(res.status).toBe(200);
    expect(field(res.json, "organizations")).toEqual([]);
    const put = await s.lonelyParent.put(`${base}/${s.ids.lonely}`, {});
    expect(put.status).toBe(409);
    expect(field(put.json, "error", "code")).toBe("no_school");

    // Avec une école : l'établissement est proposé.
    const withSchool = await s.parent.get(
      `/admin/organizations/${s.ids.family}/learners/${s.ids.pupil}/health-shares`,
    );
    const orgs = field(withSchool.json, "organizations");
    expect(Array.isArray(orgs) && orgs.length).toBe(1);
  });
});

describe("séance supplémentaire payante", () => {
  it("sans prix saisi, rien ne change : la séance est gratuite", async () => {
    const s = await setup();
    const booked = await bookTomorrow(s);
    expect(booked.status).toBe(201);
    expect(field(booked.json, "paymentRequired")).toBe(false);
    const id = text(booked.json, "id");
    expect(
      field((await s.parent.get(`/agenda/sessions/${id}`)).json, "payment"),
    ).toBeNull();
    expect((await s.prof.post(`/agenda/sessions/${id}/confirm`)).status).toBe(
      200,
    );
  });

  it("avec un prix : confirmée seulement après le paiement", async () => {
    const s = await setup();
    // Seule l'équipe Wema fixe le prix.
    const price = { currency: "eur", amountMinor: 2500, methods: ["card"] };
    expect(
      (
        await s.parent.put(
          `/admin/billing/session-prices/${s.countryId}`,
          price,
        )
      ).status,
    ).toBe(403);
    expect(
      (await s.admin.put(`/admin/billing/session-prices/${s.countryId}`, price))
        .status,
    ).toBe(200);
    const family = await s.parent.get("/agenda/family?space=guardian");
    expect(field(family.json, "bookable", "0", "price")).toEqual({
      currency: "EUR",
      amountMinor: 2500,
      methods: ["card"],
    });

    const booked = await bookTomorrow(s);
    expect(field(booked.json, "paymentRequired")).toBe(true);
    const id = text(booked.json, "id");
    const detail = await s.parent.get(`/agenda/sessions/${id}`);
    expect(field(detail.json, "payment", "paid")).toBe(false);
    expect(field(detail.json, "can", "pay")).toBe(true);

    // Le prof ne peut pas confirmer une séance non payée.
    const early = await s.prof.post(`/agenda/sessions/${id}/confirm`);
    expect(early.status).toBe(409);
    expect(field(early.json, "error", "code")).toBe("payment_required");
    expect(
      field(
        (await s.prof.get(`/agenda/sessions/${id}`)).json,
        "can",
        "confirm",
      ),
    ).toBe(false);

    // Moyen non proposé pour ce prix.
    expect(
      (
        await s.parent.post(`/agenda/sessions/${id}/checkout`, {
          method: "mobile_money",
        })
      ).status,
    ).toBe(422);
    // Un autre parent ne paie pas cette séance.
    expect(
      (
        await s.lonelyParent.post(`/agenda/sessions/${id}/checkout`, {
          method: "card",
        })
      ).status,
    ).toBe(404);

    const checkout = await s.parent.post(`/agenda/sessions/${id}/checkout`, {
      method: "card",
    });
    expect(checkout.status).toBe(201);
    const paymentId = text(checkout.json, "paymentId");
    expect(
      (
        await s.lonelyParent.post(
          `/agenda/session-payments/${paymentId}/confirm`,
          {},
        )
      ).status,
    ).toBe(404);
    const confirmed = await s.parent.post(
      `/agenda/session-payments/${paymentId}/confirm`,
      {},
    );
    expect(field(confirmed.json, "status")).toBe("succeeded");
    const after = await s.parent.get(`/agenda/sessions/${id}`);
    expect(field(after.json, "session", "status")).toBe("confirmed");
    expect(field(after.json, "payment", "paid")).toBe(true);
    expect(field(after.json, "can", "pay")).toBe(false);
    // Rejouer la confirmation ne change rien.
    expect(
      (await s.parent.post(`/agenda/session-payments/${paymentId}/confirm`, {}))
        .status,
    ).toBe(200);
    expect(
      (
        await s.parent.post(`/agenda/sessions/${id}/checkout`, {
          method: "card",
        })
      ).status,
    ).toBe(409);

    // Prix retiré : les nouvelles réservations redeviennent gratuites.
    expect(
      (await s.admin.delete(`/admin/billing/session-prices/${s.countryId}`))
        .status,
    ).toBe(200);
    const again = await s.parent.get("/agenda/family?space=guardian");
    expect(field(again.json, "bookable", "0", "price")).toBeNull();
  });
});

describe("résumé de la semaine du parent", () => {
  it("matières, activité sur 7 jours et dernière activité, depuis le journal", async () => {
    const s = await setup();
    const empty = await s.parent.get("/parent/children");
    expect(field(empty.json, "children", "0", "subjects")).toEqual(["Maths"]);
    expect(field(empty.json, "children", "0", "lastActivityAt")).toBeNull();
    const days = field(empty.json, "children", "0", "week", "days");
    expect(Array.isArray(days) && days.length).toBe(7);

    await s.db.query(
      `INSERT INTO learning_events (id, learner_id, occurred_at, source, type, payload)
       VALUES ($1, $2, now(), 'app', 'answer.submitted', $3)`,
      [
        randomUUID(),
        s.ids.pupil,
        JSON.stringify({
          type: "answer.submitted",
          notionId: s.notionId,
          correct: true,
          hintsUsed: 0,
          misconceptionId: null,
          exerciseRef: null,
          response: null,
          scaffolded: null,
          misconceptionSource: null,
          misconceptionConfidence: null,
        }),
      ],
    );
    const after = await s.parent.get("/parent/children");
    expect(field(after.json, "children", "0", "week", "answers")).toBe(1);
    expect(field(after.json, "children", "0", "week", "reworked")).toEqual([
      "Fractions",
    ]);
    expect(typeof field(after.json, "children", "0", "lastActivityAt")).toBe(
      "string",
    );
  });
});

describe("back-office : à valider et compteurs", () => {
  it("compte en base, sans plafond, et liste les notions à vérifier", async () => {
    const s = await setup();
    for (let i = 0; i < 60; i += 1)
      await s.db.query(
        `INSERT INTO contact_requests (id, name, email, profile, message, ip_hash)
         VALUES ($1, 'Visiteur', 'v@example.test', 'parent', 'Bonjour, une question.', 'x')`,
        [randomUUID()],
      );
    const counts = await s.admin.get("/admin/review/counts");
    expect(field(counts.json, "contacts")).toBe(60);
    // La notion créée n'est pas encore vérifiée.
    expect(field(counts.json, "toReview")).toBe(1);

    const queue = await s.admin.get("/admin/review");
    expect(field(queue.json, "notions", "0", "name")).toBe("Fractions");
    expect(field(queue.json, "total", "notions")).toBe(1);
    const filtered = await s.admin.get(
      `/admin/review?countryId=${randomUUID()}`,
    );
    expect(field(filtered.json, "notions")).toEqual([]);
    expect(field(filtered.json, "total", "notions")).toBe(0);

    // Validée par la route existante : elle sort de la file.
    await s.admin.patch(`/admin/curriculum/notions/${s.notionId}`, {
      unitId: s.unitId,
      code: "fractions",
      name: "Fractions",
      description: "f",
      position: 0,
      verified: true,
    });
    expect(
      field((await s.admin.get("/admin/review/counts")).json, "toReview"),
    ).toBe(0);

    // Un parent ne voit ni la file ni de compteur.
    expect((await s.parent.get("/admin/review")).status).toBe(403);
    expect((await s.parent.get("/admin/review/counts")).json).toEqual({
      toReview: null,
      contacts: null,
    });
  });
});
