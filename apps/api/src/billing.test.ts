import { addMonths, type SqlExecutor } from "@wema/db";
import { describe, expect, it } from "vitest";
import { subscriptionAccess } from "./billing/access";
import { createDevProvider } from "./billing/dev";
import { createKkiapayProvider } from "./billing/kkiapay";
import { billingFromEnv } from "./billing/setup";
import {
  createStripeProvider,
  signStripePayload,
  verifyStripeSignature,
} from "./billing/stripe";
import type { BillingDeps, Fetch } from "./billing/types";
import { ADMIN, APP, browser, field, testServer, text } from "./test-helpers";

const STRIPE_SECRET = "whsec_secret_de_test";
const KKIAPAY_SECRET = "secret-webhook-kkiapay-de-test";

/** Faux réseau des fournisseurs : réponses prévues par URL, requêtes gardées. */
function fakeNetwork() {
  const calls: { url: string; body: string | undefined }[] = [];
  const kkiapay = new Map<
    string,
    { status: string; amount: number; partnerId?: string }
  >();
  const stripeSessions = new Map<string, Record<string, unknown>>();
  const fetcher: Fetch = async (url, init) => {
    calls.push({ url, body: init.body });
    const json = (value: unknown, status = 200) => ({
      ok: status < 300,
      status,
      json: async () => value,
    });
    if (url.endsWith("/v1/checkout/sessions") && init.method === "POST") {
      const params = new URLSearchParams(init.body ?? "");
      const id = `cs_test_${stripeSessions.size + 1}`;
      const session = {
        id,
        url: `https://checkout.stripe.test/${id}`,
        client_reference_id: params.get("client_reference_id"),
        status: "open",
        payment_status: "unpaid",
        subscription: null,
      };
      stripeSessions.set(id, session);
      return json(session);
    }
    const sessionMatch = url.match(/\/v1\/checkout\/sessions\/([^/]+)$/);
    if (sessionMatch?.[1])
      return json(stripeSessions.get(sessionMatch[1]) ?? {}, 200);
    if (url.includes("/v1/subscriptions/")) return json({ id: "sub" });
    if (url.endsWith("/api/v1/transactions/status")) {
      const id = JSON.parse(init.body ?? "{}").transactionId;
      const tx = kkiapay.get(id);
      return tx ? json({ transactionId: id, ...tx }) : json({}, 404);
    }
    return json({}, 404);
  };
  return { fetcher, calls, kkiapay, stripeSessions };
}

type Network = ReturnType<typeof fakeNetwork>;

const realProviders =
  (net: Network) =>
  (db: SqlExecutor): BillingDeps => {
    const kkiapay = createKkiapayProvider(
      {
        publicKey: "pk_test",
        privateKey: "priv_test",
        secretKey: "sk_test",
        sandbox: true,
      },
      net.fetcher,
    );
    return {
      providers: {
        card: createStripeProvider(
          { secretKey: "sk_test_stripe" },
          net.fetcher,
        ),
        mobile_money: kkiapay,
      },
      stripeWebhookSecret: STRIPE_SECRET,
      kkiapayWebhookSecret: KKIAPAY_SECRET,
      kkiapay,
      access: subscriptionAccess(db),
    };
  };

const devProviders = (db: SqlExecutor): BillingDeps => ({
  providers: { card: createDevProvider(), mobile_money: createDevProvider() },
  stripeWebhookSecret: null,
  kkiapayWebhookSecret: null,
  kkiapay: null,
  access: subscriptionAccess(db),
});

/**
 * Référentiel minimal (un pays, une matière, une notion), une famille avec un
 * parent et un enfant, et une offre réglée dans le back-office.
 */
async function setup(billing: (db: SqlExecutor) => BillingDeps) {
  const server = await testServer({}, undefined, undefined, billing);
  const admin = browser(server.app);
  await admin.post("/auth/login", ADMIN);
  const countryId = text(
    (
      await admin.post("/admin/curriculum/countries", {
        code: "ZZ",
        name: "Pays test",
        unitLabel: { singular: "U", plural: "U" },
      })
    ).json,
    "id",
  );
  const subjectId = text(
    (
      await admin.post("/admin/curriculum/subjects", {
        code: "matiere-a",
        name: "Matière A",
      })
    ).json,
    "id",
  );
  const otherSubjectId = text(
    (
      await admin.post("/admin/curriculum/subjects", {
        code: "matiere-b",
        name: "Matière B",
      })
    ).json,
    "id",
  );
  const gradeId = text(
    (
      await admin.post(`/admin/curriculum/countries/${countryId}/grades`, {
        name: "Niveau 1",
        position: 0,
      })
    ).json,
    "id",
  );
  const notionIn = async (subject: string, code: string) => {
    const programId = text(
      (
        await admin.post("/admin/curriculum/programs", {
          gradeId,
          subjectId: subject,
        })
      ).json,
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
    return text(
      (
        await admin.post("/admin/curriculum/notions", {
          unitId,
          code,
          name: `Notion ${code}`,
          description: "Une notion de test.",
          position: 0,
        })
      ).json,
      "id",
    );
  };
  const notionId = await notionIn(subjectId, "n-a");
  const otherNotionId = await notionIn(otherSubjectId, "n-b");

  const family = text(
    (
      await admin.post("/admin/organizations", {
        name: "Famille",
        kind: "family",
      })
    ).json,
    "id",
  );
  const role = async (name: string, permissions: string[]) =>
    text(
      (
        await admin.post(`/admin/organizations/${family}/roles`, {
          name,
          permissions,
        })
      ).json,
      "id",
    );
  const parentRole = await role("Parent", ["learners.read"]);
  const childRole = await role("Enfant", []);
  const member = async (roleId: string, name: string, email: string) =>
    text(
      (
        await admin.post(`/admin/organizations/${family}/members`, {
          displayName: name,
          roleId,
          login: { kind: "email", email, password: "mot-de-passe-test" },
        })
      ).json,
      "userId",
    );
  const parentId = await member(parentRole, "Parent", "parent@example.test");
  const childId = await member(childRole, "Enfant", "enfant@example.test");
  await admin.post(`/admin/organizations/${family}/guardianships`, {
    guardianId: parentId,
    learnerId: childId,
  });
  // L'enfant suit un programme (ici choisi par son parent) : les offres
  // suivent le pays de ce programme (fiche 0010).
  const firstProgram = await server.db.query<{ id: string }>(
    "SELECT p.id FROM programs p WHERE p.subject_id = $1",
    [subjectId],
  );
  await server.db.query(
    `INSERT INTO learner_programs (learner_id, program_id, subject_id, organization_id, chosen_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [childId, firstProgram.rows[0]?.id, subjectId, family, parentId],
  );

  const offerId = text(
    (
      await admin.post("/admin/billing/offers", {
        countryId,
        subjectId,
        currency: "xof",
        amountMinor: 7350,
        intervalMonths: 1,
        trialDays: 7,
        methods: ["card", "mobile_money"],
        active: true,
      })
    ).json,
    "id",
  );

  const parent = browser(server.app);
  await parent.post("/auth/login", {
    email: "parent@example.test",
    password: "mot-de-passe-test",
  });
  const learner = browser(server.app);
  await learner.post("/auth/login", {
    email: "enfant@example.test",
    password: "mot-de-passe-test",
  });
  const openSession = (notion: string) =>
    learner.post("/learner/tutor/sessions", {
      mode: "course_question",
      notionId: notion,
    });
  return {
    ...server,
    admin,
    parent,
    learner,
    family,
    childId,
    subjectId,
    countryId,
    notionId,
    otherNotionId,
    offerId,
    openSession,
  };
}

/** Envoie un webhook Stripe signé (ou mal signé). */
async function stripeWebhook(
  app: Awaited<ReturnType<typeof setup>>["app"],
  event: unknown,
  secret = STRIPE_SECRET,
  at = new Date(),
) {
  const payload = JSON.stringify(event);
  const res = await app.request("/api/billing/webhooks/stripe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signStripePayload(payload, secret, at),
    },
    body: payload,
  });
  return { status: res.status, json: await res.json() };
}

async function periodEnd(db: SqlExecutor, learnerId: string) {
  const { rows } = await db.query<{
    current_period_end: Date | null;
    status: string;
  }>(
    "SELECT current_period_end, status FROM subscriptions WHERE learner_id = $1 AND status <> 'ended'",
    [learnerId],
  );
  return rows[0] ?? null;
}

describe("droits d'accès aux matières", () => {
  it("sans abonnement, le prof IA d'une matière est fermé avec un message clair ; l'entretien reste libre", async () => {
    const s = await setup(devProviders);
    const refused = await s.openSession(s.notionId);
    expect(refused.status).toBe(402);
    expect(field(refused.json, "error", "code")).toBe("subscription_required");
    expect(field(refused.json, "error", "details", "subscribePath")).toBe(
      "/parent/abonnements",
    );
    // L'entretien initial est gratuit.
    expect(
      (await s.learner.post("/learner/tutor/sessions", { mode: "intake" }))
        .status,
    ).toBe(201);
  });

  it("l'élève sait dès l'ouverture de la page si la matière est ouverte", async () => {
    const s = await setup(devProviders);
    const openOf = async () => {
      const classes = field(
        (await s.learner.get("/learner/path")).json,
        "classes",
      );
      return Array.isArray(classes) ? field(classes[0], "open") : undefined;
    };
    expect(await openOf()).toBe(false);
    await s.parent.post("/parent/billing/trial", {
      learnerId: s.childId,
      offerId: s.offerId,
    });
    expect(await openOf()).toBe(true);
  });

  it("un essai ouvre la matière, et seulement elle ; une seule fois", async () => {
    const s = await setup(devProviders);
    const trial = await s.parent.post("/parent/billing/trial", {
      learnerId: s.childId,
      offerId: s.offerId,
    });
    expect(trial.status).toBe(201);
    expect((await s.openSession(s.notionId)).status).toBe(201);
    expect((await s.openSession(s.otherNotionId)).status).toBe(402);
    // Résilié, l'essai s'arrête tout de suite ; un second essai est refusé.
    const id = text(trial.json, "id");
    expect(
      (await s.parent.post(`/parent/billing/subscriptions/${id}/cancel`))
        .status,
    ).toBe(200);
    expect((await s.openSession(s.notionId)).status).toBe(402);
    expect(
      (
        await s.parent.post("/parent/billing/trial", {
          learnerId: s.childId,
          offerId: s.offerId,
        })
      ).status,
    ).toBe(409);
  });

  it("une séance ouverte se ferme quand l'accès tombe", async () => {
    const s = await setup(devProviders);
    await s.parent.post("/parent/billing/trial", {
      learnerId: s.childId,
      offerId: s.offerId,
    });
    const session = text(
      (await s.openSession(s.notionId)).json,
      "session",
      "id",
    );
    await s.db.query(
      "UPDATE subscriptions SET trial_ends_at = now() - interval '1 day'",
    );
    const message = await s.learner.post(
      `/learner/tutor/sessions/${session}/messages`,
      { content: "Bonjour" },
    );
    expect(message.status).toBe(402);
  });

  it("une organisation sous contrat ouvre toutes les matières de ses élèves", async () => {
    const s = await setup(devProviders);
    const school = text(
      (
        await s.admin.post("/admin/organizations", {
          name: "École",
          kind: "school",
        })
      ).json,
      "id",
    );
    const roleId = text(
      (
        await s.admin.post(`/admin/organizations/${school}/roles`, {
          name: "Élève",
          permissions: [],
        })
      ).json,
      "id",
    );
    await s.admin.post(`/admin/organizations/${school}/members`, {
      displayName: "Enfant",
      roleId,
      login: { kind: "email", email: "enfant@example.test" },
    });
    expect((await s.openSession(s.otherNotionId)).status).toBe(402);
    expect(
      (
        await s.admin.put(`/admin/billing/contracts/${school}`, {
          underContract: true,
        })
      ).status,
    ).toBe(200);
    expect((await s.openSession(s.notionId)).status).toBe(201);
    expect((await s.openSession(s.otherNotionId)).status).toBe(201);
    // Une famille ne peut pas être « sous contrat ».
    expect(
      (
        await s.admin.put(`/admin/billing/contracts/${s.family}`, {
          underContract: true,
        })
      ).status,
    ).toBe(404);
    // Seule l'équipe Wema pose le statut.
    expect(
      (
        await s.parent.put(`/admin/billing/contracts/${school}`, {
          underContract: false,
        })
      ).status,
    ).toBe(403);
  });
});

describe("parcours de paiement (faux fournisseur de développement)", () => {
  it("payer ouvre l'accès pour une période ; résilier le garde jusqu'à l'échéance", async () => {
    const s = await setup(devProviders);
    const checkout = await s.parent.post("/parent/billing/checkout", {
      learnerId: s.childId,
      offerId: s.offerId,
      method: "card",
    });
    expect(checkout.status).toBe(201);
    const paymentId = text(checkout.json, "paymentId");
    expect(text(checkout.json, "next", "url")).toBe(
      `${APP}/parent/abonnements/retour?paiement=${paymentId}`,
    );
    expect((await s.openSession(s.notionId)).status).toBe(402);
    const confirmed = await s.parent.post(
      `/parent/billing/payments/${paymentId}/confirm`,
    );
    expect(field(confirmed.json, "status")).toBe("succeeded");
    expect((await s.openSession(s.notionId)).status).toBe(201);
    const end = await periodEnd(s.db, s.childId);
    expect(end?.status).toBe("active");

    const view = await s.parent.get("/parent/billing");
    const sub = field(view.json, "children", "0", "subscriptions", "0");
    expect(field(sub, "status")).toBe("active");
    expect(field(sub, "open")).toBe(true);
    expect(field(view.json, "payments", "0", "status")).toBe("succeeded");
  });

  it("confirmer deux fois ne prolonge pas deux fois ; un autre parent ne peut pas confirmer", async () => {
    const s = await setup(devProviders);
    const paymentId = text(
      (
        await s.parent.post("/parent/billing/checkout", {
          learnerId: s.childId,
          offerId: s.offerId,
          method: "mobile_money",
        })
      ).json,
      "paymentId",
    );
    await s.parent.post(`/parent/billing/payments/${paymentId}/confirm`);
    const first = await periodEnd(s.db, s.childId);
    await s.parent.post(`/parent/billing/payments/${paymentId}/confirm`);
    expect((await periodEnd(s.db, s.childId))?.current_period_end).toEqual(
      first?.current_period_end,
    );
    expect(
      (await s.learner.post(`/parent/billing/payments/${paymentId}/confirm`))
        .status,
    ).toBe(404);
  });

  it("un renouvellement anticipé part de l'échéance en cours ; la résiliation garde l'accès payé", async () => {
    const s = await setup(devProviders);
    const pay = async () => {
      const id = text(
        (
          await s.parent.post("/parent/billing/checkout", {
            learnerId: s.childId,
            offerId: s.offerId,
            method: "card",
          })
        ).json,
        "paymentId",
      );
      await s.parent.post(`/parent/billing/payments/${id}/confirm`);
    };
    await pay();
    const first = (await periodEnd(s.db, s.childId))?.current_period_end;
    await pay();
    const second = (await periodEnd(s.db, s.childId))?.current_period_end;
    expect(first && second?.getTime()).toBe(
      first && addMonths(first, 1).getTime(),
    );
    const { rows } = await s.db.query<{ id: string }>(
      "SELECT id FROM subscriptions",
    );
    await s.parent.post(`/parent/billing/subscriptions/${rows[0]?.id}/cancel`);
    expect((await periodEnd(s.db, s.childId))?.status).toBe("canceled");
    expect((await s.openSession(s.notionId)).status).toBe(201);
    // Échéance passée : l'accès se ferme.
    await s.db.query(
      "UPDATE subscriptions SET current_period_end = now() - interval '1 minute'",
    );
    expect((await s.openSession(s.notionId)).status).toBe(402);
  });

  it("seul un parent de l'enfant peut souscrire, et seulement avec un moyen proposé par l'offre", async () => {
    const s = await setup(devProviders);
    expect(
      (
        await s.learner.post("/parent/billing/checkout", {
          learnerId: s.childId,
          offerId: s.offerId,
          method: "card",
        })
      ).status,
    ).toBe(404);
    const offer = await s.admin.get("/admin/billing/offers");
    const countryId = text(field(offer.json, "offers", "0"), "countryId");
    const subjectId = text(field(offer.json, "offers", "0"), "subjectId");
    await s.admin.patch(`/admin/billing/offers/${s.offerId}`, {
      currency: "XOF",
      amountMinor: 7350,
      intervalMonths: 1,
      trialDays: 0,
      methods: ["mobile_money"],
      active: true,
    });
    expect(countryId && subjectId).toBeTruthy();
    expect(
      (
        await s.parent.post("/parent/billing/checkout", {
          learnerId: s.childId,
          offerId: s.offerId,
          method: "card",
        })
      ).status,
    ).toBe(422);
  });
});

describe("aucun prix en dur", () => {
  it("le montant, la devise et la période viennent de l'offre réglée dans le back-office", async () => {
    const net = fakeNetwork();
    const s = await setup(realProviders(net));
    // Prix inhabituel, devise et période changées par l'équipe Wema.
    expect(
      (
        await s.admin.patch(`/admin/billing/offers/${s.offerId}`, {
          currency: "chf",
          amountMinor: 4321,
          intervalMonths: 3,
          trialDays: 0,
          methods: ["card"],
          active: true,
        })
      ).status,
    ).toBe(200);
    const view = await s.parent.get("/parent/billing");
    expect(field(view.json, "offers", "0", "amountMinor")).toBe(4321);
    expect(field(view.json, "offers", "0", "currency")).toBe("CHF");
    await s.parent.post("/parent/billing/checkout", {
      learnerId: s.childId,
      offerId: s.offerId,
      method: "card",
    });
    const sent = new URLSearchParams(net.calls[0]?.body ?? "");
    expect(sent.get("line_items[0][price_data][unit_amount]")).toBe("4321");
    expect(sent.get("line_items[0][price_data][currency]")).toBe("chf");
    expect(
      sent.get("line_items[0][price_data][recurring][interval_count]"),
    ).toBe("3");
    // Le prix payé est recopié : changer l'offre ensuite ne le modifie pas.
    await s.admin.patch(`/admin/billing/offers/${s.offerId}`, {
      currency: "CHF",
      amountMinor: 9999,
      intervalMonths: 1,
      trialDays: 0,
      methods: ["card"],
      active: true,
    });
    const { rows } = await s.db.query<{ amount_minor: number }>(
      "SELECT amount_minor FROM payments",
    );
    expect(rows[0]?.amount_minor).toBe(4321);
  });

  it("une offre en double pour le même pays et la même matière est refusée", async () => {
    const s = await setup(devProviders);
    const again = await s.admin.post("/admin/billing/offers", {
      countryId: s.countryId,
      subjectId: s.subjectId,
      currency: "EUR",
      amountMinor: 100,
      intervalMonths: 1,
      trialDays: 0,
      methods: ["card"],
      active: true,
    });
    expect(again.status).toBe(409);
    expect(
      (
        await s.parent.post("/admin/billing/offers", {
          countryId: s.countryId,
          subjectId: s.subjectId,
          currency: "EUR",
          amountMinor: 100,
          intervalMonths: 1,
          trialDays: 0,
          methods: ["card"],
          active: false,
        })
      ).status,
    ).toBe(403);
  });
});

describe("pays de l'offre", () => {
  it("l'offre suit le pays du programme de l'élève (classe ou programme individuel)", async () => {
    const s = await setup(devProviders);
    // Un autre pays, avec la même matière moins chère.
    const otherCountry = text(
      (
        await s.admin.post("/admin/curriculum/countries", {
          code: "YY",
          name: "Autre pays",
          unitLabel: { singular: "U", plural: "U" },
        })
      ).json,
      "id",
    );
    const cheaper = text(
      (
        await s.admin.post("/admin/billing/offers", {
          countryId: otherCountry,
          subjectId: s.subjectId,
          currency: "EUR",
          amountMinor: 100,
          intervalMonths: 1,
          trialDays: 7,
          methods: ["card"],
          active: true,
        })
      ).json,
      "id",
    );
    // Programme individuel du pays ZZ (choisi par le parent) : l'offre d'un
    // autre pays est refusée, comme pour une classe.
    const mismatch = await s.parent.post("/parent/billing/checkout", {
      learnerId: s.childId,
      offerId: cheaper,
      method: "card",
    });
    expect(field(mismatch.json, "error", "code")).toBe(
      "offer_country_mismatch",
    );
    const view = await s.parent.get("/parent/billing");
    expect(JSON.stringify(field(view.json, "children"))).not.toContain(cheaper);
    // Sans aucun programme, le pays n'est pas connu : aucune offre, jamais un
    // pays pris au hasard.
    await s.db.query("DELETE FROM learner_programs WHERE learner_id = $1", [
      s.childId,
    ]);
    for (const offerId of [cheaper, s.offerId]) {
      const unknown = await s.parent.post("/parent/billing/trial", {
        learnerId: s.childId,
        offerId,
      });
      expect(unknown.status).toBe(422);
      expect(field(unknown.json, "error", "code")).toBe("program_required");
    }
    // Inscrit dans une classe d'un programme du pays ZZ.
    const { rows } = await s.db.query<{ id: string }>(
      `SELECT p.id FROM programs p JOIN grades g ON g.id = p.grade_id
       WHERE g.country_id = $1 AND p.subject_id = $2`,
      [s.countryId, s.subjectId],
    );
    await s.db.query(
      `INSERT INTO classes (id, organization_id, name, program_id)
       VALUES (gen_random_uuid(), $1, 'Classe test', $2)`,
      [s.family, rows[0]?.id],
    );
    await s.db.query(
      `INSERT INTO class_members (class_id, user_id, role)
       SELECT id, $1, 'learner' FROM classes WHERE name = 'Classe test'`,
      [s.childId],
    );
    for (const path of ["/parent/billing/checkout", "/parent/billing/trial"]) {
      const refused = await s.parent.post(path, {
        learnerId: s.childId,
        offerId: cheaper,
        method: "card",
      });
      expect(refused.status).toBe(422);
      expect(field(refused.json, "error", "code")).toBe(
        "offer_country_mismatch",
      );
    }
    expect(
      (
        await s.parent.post("/parent/billing/checkout", {
          learnerId: s.childId,
          offerId: s.offerId,
          method: "card",
        })
      ).status,
    ).toBe(201);
  });
});

describe("webhooks Stripe", () => {
  async function paidWithStripe() {
    const net = fakeNetwork();
    const s = await setup(realProviders(net));
    const checkout = await s.parent.post("/parent/billing/checkout", {
      learnerId: s.childId,
      offerId: s.offerId,
      method: "card",
    });
    expect(text(checkout.json, "next", "url")).toMatch(
      /^https:\/\/checkout\.stripe\.test\//,
    );
    const paymentId = text(checkout.json, "paymentId");
    const completed = {
      id: "evt_completed",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          client_reference_id: paymentId,
          payment_status: "paid",
          subscription: "sub_123",
        },
      },
    };
    return { s, net, paymentId, completed };
  }

  it("signature valide : l'abonnement est activé ; rejoué : appliqué une seule fois", async () => {
    const { s, completed } = await paidWithStripe();
    expect((await s.openSession(s.notionId)).status).toBe(402);
    const first = await stripeWebhook(s.app, completed);
    expect(first.status).toBe(200);
    expect(field(first.json, "outcome")).toBe("applied");
    expect((await s.openSession(s.notionId)).status).toBe(201);
    const end = (await periodEnd(s.db, s.childId))?.current_period_end;
    const replay = await stripeWebhook(s.app, completed);
    expect(field(replay.json, "outcome")).toBe("duplicate");
    expect((await periodEnd(s.db, s.childId))?.current_period_end).toEqual(end);
  });

  it("signature invalide, absente ou trop ancienne : refusée, rien n'est appliqué", async () => {
    const { s, completed } = await paidWithStripe();
    expect((await stripeWebhook(s.app, completed, "whsec_autre")).status).toBe(
      400,
    );
    const old = new Date(Date.now() - 10 * 60 * 1000);
    expect(
      (await stripeWebhook(s.app, completed, STRIPE_SECRET, old)).status,
    ).toBe(400);
    const res = await s.app.request("/api/billing/webhooks/stripe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(completed),
    });
    expect(res.status).toBe(400);
    expect((await s.openSession(s.notionId)).status).toBe(402);
  });

  it("renouvellement payé : l'échéance avance une fois ; résiliation chez Stripe : accès coupé", async () => {
    const { s, completed } = await paidWithStripe();
    await stripeWebhook(s.app, completed);
    const periodEndAt = Math.floor(Date.now() / 1000) + 60 * 24 * 3600;
    const renewal = {
      id: "evt_invoice_2",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_2",
          billing_reason: "subscription_cycle",
          subscription: "sub_123",
          amount_paid: 7350,
          currency: "xof",
          lines: { data: [{ period: { end: periodEndAt } }] },
        },
      },
    };
    expect(field((await stripeWebhook(s.app, renewal)).json, "outcome")).toBe(
      "applied",
    );
    expect(
      (await periodEnd(s.db, s.childId))?.current_period_end?.getTime(),
    ).toBe(periodEndAt * 1000);
    // Même facture sous un autre événement : pas de second paiement.
    await stripeWebhook(s.app, { ...renewal, id: "evt_invoice_2_bis" });
    const { rows } = await s.db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM payments WHERE kind = 'renewal'",
    );
    expect(rows[0]?.n).toBe(1);
    // Un second paiement Stripe est refusé tant que l'abonnement court.
    expect(
      (
        await s.parent.post("/parent/billing/checkout", {
          learnerId: s.childId,
          offerId: s.offerId,
          method: "card",
        })
      ).status,
    ).toBe(409);

    await stripeWebhook(s.app, {
      id: "evt_failed",
      type: "invoice.payment_failed",
      data: { object: { id: "in_3", subscription: "sub_123" } },
    });
    expect((await periodEnd(s.db, s.childId))?.status).toBe("past_due");
    expect((await s.openSession(s.notionId)).status).toBe(201);

    await stripeWebhook(s.app, {
      id: "evt_deleted",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123" } },
    });
    expect(await periodEnd(s.db, s.childId)).toBeNull();
    expect((await s.openSession(s.notionId)).status).toBe(402);
  });

  it("sécurité : un paiement Mobile Money n'efface pas l'abonnement Stripe en cours (qui resterait prélevé sans pouvoir être résilié)", async () => {
    const { s, net, completed } = await paidWithStripe();
    // Paiement Mobile Money ouvert avant que Stripe ne soit payé.
    const momo = text(
      (
        await s.parent.post("/parent/billing/checkout", {
          learnerId: s.childId,
          offerId: s.offerId,
          method: "mobile_money",
        })
      ).json,
      "paymentId",
    );
    await stripeWebhook(s.app, completed);
    net.kkiapay.set("tx-momo", {
      status: "SUCCESS",
      amount: 7350,
      partnerId: momo,
    });
    await s.parent.post(`/parent/billing/payments/${momo}/confirm`, {
      transactionId: "tx-momo",
    });
    const { rows } = await s.db.query<{
      provider: string;
      external_id: string;
    }>(
      "SELECT provider, external_id FROM subscriptions WHERE status <> 'ended'",
    );
    expect(rows[0]).toMatchObject({
      provider: "stripe",
      external_id: "sub_123",
    });
  });

  it("au retour, le paiement est confirmé en interrogeant Stripe (sans attendre le webhook)", async () => {
    const { s, net, paymentId } = await paidWithStripe();
    const session = net.stripeSessions.get("cs_test_1");
    if (session) {
      session.status = "complete";
      session.payment_status = "paid";
      session.subscription = "sub_999";
    }
    const confirmed = await s.parent.post(
      `/parent/billing/payments/${paymentId}/confirm`,
    );
    expect(field(confirmed.json, "status")).toBe("succeeded");
    const { rows } = await s.db.query<{ external_id: string }>(
      "SELECT external_id FROM subscriptions",
    );
    expect(rows[0]?.external_id).toBe("sub_999");
    // Résilier chez Stripe : fin à l'échéance, demandée par l'API.
    const subId = (
      await s.db.query<{ id: string }>("SELECT id FROM subscriptions")
    ).rows[0]?.id;
    await s.parent.post(`/parent/billing/subscriptions/${subId}/cancel`);
    const cancel = net.calls.find((c) =>
      c.url.endsWith("/v1/subscriptions/sub_999"),
    );
    expect(cancel?.body).toBe("cancel_at_period_end=true");
  });
});

describe("Kkiapay (Mobile Money)", () => {
  async function started() {
    const net = fakeNetwork();
    const s = await setup(realProviders(net));
    const checkout = await s.parent.post("/parent/billing/checkout", {
      learnerId: s.childId,
      offerId: s.offerId,
      method: "mobile_money",
    });
    expect(field(checkout.json, "next", "kind")).toBe("kkiapay");
    expect(field(checkout.json, "next", "amount")).toBe(7350);
    return { s, net, paymentId: text(checkout.json, "paymentId") };
  }

  const kkiapayWebhook = (
    app: Awaited<ReturnType<typeof setup>>["app"],
    body: unknown,
    secret = KKIAPAY_SECRET,
  ) =>
    app.request("/api/billing/webhooks/kkiapay", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kkiapay-secret": secret,
      },
      body: JSON.stringify(body),
    });

  it("le retour du navigateur est vérifié auprès de Kkiapay : montant et référence", async () => {
    const { s, net, paymentId } = await started();
    net.kkiapay.set("tx-faux-montant", {
      status: "SUCCESS",
      amount: 100,
      partnerId: paymentId,
    });
    expect(
      (
        await s.parent.post(`/parent/billing/payments/${paymentId}/confirm`, {
          transactionId: "tx-faux-montant",
        })
      ).status,
    ).toBe(409);
    net.kkiapay.set("tx-ok", {
      status: "SUCCESS",
      amount: 7350,
      partnerId: paymentId,
    });
    const ok = await s.parent.post(
      `/parent/billing/payments/${paymentId}/confirm`,
      { transactionId: "tx-ok" },
    );
    expect(field(ok.json, "status")).toBe("succeeded");
    expect((await s.openSession(s.notionId)).status).toBe(201);
  });

  it("une transaction sans référence Wema ne paie rien (refus par défaut)", async () => {
    const { s, net, paymentId } = await started();
    net.kkiapay.set("tx-sans-ref", { status: "SUCCESS", amount: 7350 });
    const res = await s.parent.post(
      `/parent/billing/payments/${paymentId}/confirm`,
      { transactionId: "tx-sans-ref" },
    );
    expect(field(res.json, "status")).not.toBe("succeeded");
    expect((await s.openSession(s.notionId)).status).toBe(402);
  });

  it("une transaction ne paie qu'un seul paiement", async () => {
    const { s, net, paymentId } = await started();
    net.kkiapay.set("tx-1", {
      status: "SUCCESS",
      amount: 7350,
      partnerId: paymentId,
    });
    await s.parent.post(`/parent/billing/payments/${paymentId}/confirm`, {
      transactionId: "tx-1",
    });
    const second = text(
      (
        await s.parent.post("/parent/billing/checkout", {
          learnerId: s.childId,
          offerId: s.offerId,
          method: "mobile_money",
        })
      ).json,
      "paymentId",
    );
    expect(
      (
        await s.parent.post(`/parent/billing/payments/${second}/confirm`, {
          transactionId: "tx-1",
        })
      ).status,
    ).toBe(409);
  });

  it("webhook : secret invalide refusé ; valide appliqué ; rejoué ignoré", async () => {
    const { s, net, paymentId } = await started();
    net.kkiapay.set("tx-web", {
      status: "SUCCESS",
      amount: 7350,
      partnerId: paymentId,
    });
    expect(
      (await kkiapayWebhook(s.app, { transactionId: "tx-web" }, "mauvais"))
        .status,
    ).toBe(401);
    expect((await s.openSession(s.notionId)).status).toBe(402);
    // Le corps prétend un échec : c'est l'état chez Kkiapay qui compte.
    const res = await kkiapayWebhook(s.app, {
      transactionId: "tx-web",
      isPaymentSucces: false,
    });
    expect(field(await res.json(), "outcome")).toBe("applied");
    expect((await s.openSession(s.notionId)).status).toBe(201);
    const replay = await kkiapayWebhook(s.app, { transactionId: "tx-web" });
    expect(field(await replay.json(), "outcome")).toBe("duplicate");
  });

  it("Kkiapay refuse une devise qu'il ne gère pas", async () => {
    const net = fakeNetwork();
    const s = await setup(realProviders(net));
    await s.admin.patch(`/admin/billing/offers/${s.offerId}`, {
      currency: "EUR",
      amountMinor: 900,
      intervalMonths: 1,
      trialDays: 0,
      methods: ["mobile_money"],
      active: true,
    });
    expect(
      (
        await s.parent.post("/parent/billing/checkout", {
          learnerId: s.childId,
          offerId: s.offerId,
          method: "mobile_money",
        })
      ).status,
    ).toBe(422);
  });
});

describe("outils", () => {
  it("sécurité : en production, le bac à sable Kkiapay est refusé (des paiements fictifs ouvriraient un vrai accès)", () => {
    const env = {
      KKIAPAY_PUBLIC_KEY: "pk",
      KKIAPAY_PRIVATE_KEY: "priv",
      KKIAPAY_SECRET_KEY: "sk",
      KKIAPAY_WEBHOOK_SECRET: "wh",
      KKIAPAY_SANDBOX: "true",
    };
    // Base jamais interrogée ici : on ne teste que le choix des fournisseurs.
    const db: SqlExecutor = {
      query: async () => ({ rows: [] }),
      exec: async () => {},
      transaction: (fn) => fn(db),
    };
    expect(billingFromEnv(env, { db, production: true }).ok).toBe(false);
    expect(billingFromEnv(env, { db, production: false }).ok).toBe(true);
  });

  it("vérifie la signature Stripe en temps constant, avec une tolérance de 5 minutes", () => {
    const now = new Date("2026-11-03T10:00:00Z");
    const header = signStripePayload("{}", "whsec_x", now);
    expect(
      verifyStripeSignature({ payload: "{}", header, secret: "whsec_x", now }),
    ).toBe(true);
    expect(
      verifyStripeSignature({ payload: "{ }", header, secret: "whsec_x", now }),
    ).toBe(false);
    expect(
      verifyStripeSignature({
        payload: "{}",
        header,
        secret: "whsec_x",
        now: new Date(now.getTime() + 6 * 60 * 1000),
      }),
    ).toBe(false);
    expect(
      verifyStripeSignature({
        payload: "{}",
        header: "t=abc,v1=zz",
        secret: "whsec_x",
        now,
      }),
    ).toBe(false);
  });

  it("ajoute des mois sans déborder sur le mois suivant", () => {
    expect(addMonths(new Date("2026-01-31T12:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T12:00:00.000Z",
    );
    expect(addMonths(new Date("2026-11-15T00:00:00Z"), 3).toISOString()).toBe(
      "2027-02-15T00:00:00.000Z",
    );
  });
});
