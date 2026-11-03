import { randomUUID } from "node:crypto";
import { createNudgeStore } from "@wema/db";
import { asLearnerId, ok } from "@wema/domain";
import { describe, expect, it } from "vitest";
import type {
  EmailMessage,
  EmailSender,
  Senders,
  TextMessage,
  TextSender,
} from "./notify/channels";
import {
  checkPushReceipts,
  runNotifications,
  sendDueNotifications,
} from "./notify/dispatch";
import type { PushMessage, PushReceipt, PushSender } from "./notify/expo";
import { looksCommercial, unsubscribeToken } from "./notify/rules";
import { ADMIN, browser, field, testServer, text, WEB } from "./test-helpers";

const PASSWORD = "mot-de-passe-de-test-1";
const SECRET = "secret-de-test"; // codeSecret de testServer

/** Faux prestataires : gardent ce qui serait parti. */
function fakeSenders() {
  const texts: TextMessage[] = [];
  const emails: EmailMessage[] = [];
  const text = (channel: "sms" | "whatsapp"): TextSender => ({
    provider: "faux",
    channels: [channel],
    send: async (m) => {
      texts.push(m);
      return ok({ provider: "faux", ref: "ref-1" });
    },
  });
  const email: EmailSender = {
    provider: "faux",
    send: async (m) => {
      emails.push(m);
      return ok({ provider: "faux", ref: "ref-2" });
    },
  };
  const senders: Senders = {
    sms: text("sms"),
    whatsapp: text("whatsapp"),
    email,
  };
  return { senders, texts, emails };
}

/** Collège : 4e A (Prof, Élève Un) ; Famille : Parent suit Élève Un ; Élève Deux à part. */
async function setup() {
  const server = await testServer();
  const admin = browser(server.app);
  await admin.post("/auth/login", ADMIN);
  const org = async (name: string, kind: string) =>
    text((await admin.post("/admin/organizations", { name, kind })).json, "id");
  const role = async (orgId: string, name: string, permissions: string[]) =>
    text(
      (
        await admin.post(`/admin/organizations/${orgId}/roles`, {
          name,
          permissions,
        })
      ).json,
      "id",
    );
  const member = async (
    orgId: string,
    roleId: string,
    displayName: string,
    email: string,
  ) =>
    text(
      (
        await admin.post(`/admin/organizations/${orgId}/members`, {
          displayName,
          roleId,
          login: { kind: "email", email, password: PASSWORD },
        })
      ).json,
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
  const prof = await member(school, profRole, "Prof Un", "prof@example.test");
  const pupil = await member(
    school,
    pupilRole,
    "Élève Un",
    "eleve1@example.test",
  );
  const other = await member(
    school,
    pupilRole,
    "Élève Deux",
    "eleve2@example.test",
  );
  const family = await org("Famille", "family");
  const parentRole = await role(family, "Parent", ["learners.read"]);
  const childRole = await role(family, "Enfant", []);
  const parent = await member(
    family,
    parentRole,
    "Parent",
    "parent@example.test",
  );
  await member(family, childRole, "Élève Un", "eleve1@example.test");
  await admin.post(`/admin/organizations/${family}/guardianships`, {
    guardianId: parent,
    learnerId: pupil,
  });
  const login = async (email: string) => {
    const b = browser(server.app);
    await b.post("/auth/login", { email, password: PASSWORD });
    return b;
  };
  const dir = await login("direction@example.test");
  const classId = text(
    (await dir.post(`/admin/organizations/${school}/classes`, { name: "4e A" }))
      .json,
    "id",
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
    ids: { prof, pupil, other, parent },
    prof: await login("prof@example.test"),
    pupil: await login("eleve1@example.test"),
    other: await login("eleve2@example.test"),
    parent: await login("parent@example.test"),
  };
}

/** Téléphone vérifié ajouté à la main (la connexion par code est testée ailleurs). */
async function addPhone(
  db: Awaited<ReturnType<typeof setup>>["db"],
  userId: string,
) {
  await db.query(
    "INSERT INTO identities (id, user_id, kind, identifier, verified_at) VALUES ($1, $2, 'phone', $3, now())",
    [randomUUID(), userId, `+2290100000${Math.floor(Math.random() * 90 + 10)}`],
  );
}

const deliveries = async (
  db: Awaited<ReturnType<typeof setup>>["db"],
  userId: string,
) =>
  (
    await db.query<{
      kind: string;
      channel: string;
      status: string;
      body: string;
      message_count: number | null;
      last_error: string | null;
    }>(
      "SELECT kind, channel, status, body, message_count, last_error FROM notification_deliveries WHERE user_id = $1 ORDER BY created_at",
      [userId],
    )
  ).rows;

describe("préférences de notification : droits", () => {
  it("chacun ne voit et ne change que les siennes ; il faut une session", async () => {
    const s = await setup();
    expect((await browser(s.app).get("/notifications")).status).toBe(401);
    expect(
      (await browser(s.app).put("/notifications", { nudgeChannel: "off" }))
        .status,
    ).toBe(401);

    const mine = (await s.parent.get("/notifications")).json;
    expect(field(mine, "preferences")).toEqual({
      timeZone: null,
      quietStart: 21,
      quietEnd: 8,
      nudgeChannel: "app",
      messageChannel: "app",
    });
    expect(field(mine, "available")).toEqual({
      email: true,
      sms: false,
      whatsapp: false,
    });
    expect(field(mine, "audience")).toBe("adult");
    expect(field(mine, "guardian")).toBe(true);
    expect(field((await s.pupil.get("/notifications")).json, "audience")).toBe(
      "learner",
    );

    const put = await s.parent.put("/notifications", {
      nudgeChannel: "email",
      timeZone: "Africa/Porto-Novo",
    });
    expect(put.status).toBe(200);
    // Le parent n'a rien changé pour son enfant.
    expect(
      field((await s.pupil.get("/notifications")).json, "preferences"),
    ).toMatchObject({ nudgeChannel: "app", timeZone: null });
  });

  it("refus : canal sans adresse, fuseau inconnu, heure invalide", async () => {
    const s = await setup();
    expect(
      (await s.parent.put("/notifications", { nudgeChannel: "sms" })).status,
    ).toBe(422);
    expect(
      (await s.parent.put("/notifications", { timeZone: "Mars/Olympus" }))
        .status,
    ).toBe(422);
    expect(
      (await s.parent.put("/notifications", { quietStart: 24 })).status,
    ).toBe(400);
    await addPhone(s.db, s.ids.parent);
    expect(
      (await s.parent.put("/notifications", { messageChannel: "whatsapp" }))
        .status,
    ).toBe(200);
  });

  it("compteur de non-lus : seulement ses propres fils", async () => {
    const s = await setup();
    await s.prof.post("/messages/send", {
      to: { kind: "user", userId: s.ids.pupil },
      body: "Bonjour",
    });
    await s.prof.post("/messages/send", {
      to: { kind: "user", userId: s.ids.pupil },
      body: "Tu as vu le devoir ?",
    });
    expect(
      field((await s.pupil.get("/notifications/unread")).json, "messages"),
    ).toBe(2);
    expect(
      field((await s.other.get("/notifications/unread")).json, "messages"),
    ).toBe(0);
    expect(
      field((await s.prof.get("/notifications/unread")).json, "messages"),
    ).toBe(0);
    expect((await browser(s.app).get("/notifications/unread")).status).toBe(
      401,
    );
  });
});

describe("désinscription en un clic", () => {
  it("lien signé : coupe les envois de cette sorte pour cette personne seulement", async () => {
    const s = await setup();
    await s.parent.put("/notifications", {
      nudgeChannel: "email",
      messageChannel: "email",
    });
    await s.prof.put("/notifications", { messageChannel: "email" });
    const token = unsubscribeToken(SECRET, s.ids.parent, "message");
    const res = await s.app.request(`/api/notifications/unsubscribe/${token}`);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      `${WEB}/compte/notifications/desinscription?sorte=message`,
    );
    expect(
      field((await s.parent.get("/notifications")).json, "preferences"),
    ).toMatchObject({ messageChannel: "app", nudgeChannel: "email" });
    expect(
      field((await s.prof.get("/notifications")).json, "preferences"),
    ).toMatchObject({ messageChannel: "email" });
  });

  it("POST sans cookie ni origine (messagerie e-mail, RFC 8058) ; jeton faux refusé", async () => {
    const s = await setup();
    await s.parent.put("/notifications", { nudgeChannel: "email" });
    const token = unsubscribeToken(SECRET, s.ids.parent, "nudge");
    const res = await s.app.request(`/api/notifications/unsubscribe/${token}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    });
    expect(res.status).toBe(200);
    expect(
      field((await s.parent.get("/notifications")).json, "preferences"),
    ).toMatchObject({ nudgeChannel: "app" });

    const forged = unsubscribeToken("un-autre-secret", s.ids.parent, "message");
    const bad = await s.app.request(`/api/notifications/unsubscribe/${forged}`);
    expect(bad.headers.get("location")).toContain("erreur=1");
    expect(
      (
        await s.app.request(`/api/notifications/unsubscribe/${forged}`, {
          method: "POST",
        })
      ).status,
    ).toBe(404);
  });
});

describe("envoi des relances", () => {
  const NOON = new Date("2026-11-03T12:00:00Z");

  it("à l'élève et à son parent, chacun par son canal, une seule fois", async () => {
    const s = await setup();
    const fake = fakeSenders();
    await s.parent.put("/notifications", { nudgeChannel: "email" });
    await s.pupil.put("/notifications", { nudgeChannel: "email" });
    await createNudgeStore(s.db).create({
      learnerId: asLearnerId(s.ids.pupil),
      day: "2026-11-03",
      reason: "finish_exercise",
      notionId: null,
      content: "Un exercice t'attend. On le termine ensemble ?",
      createdAt: NOON,
    });
    const deps = {
      db: s.db,
      senders: fake.senders,
      secret: SECRET,
      publicUrl: WEB,
    };
    const r = await runNotifications(deps, NOON);
    expect(r).toMatchObject({ queued: 2, sent: 2, failed: 0 });
    const toParent = fake.emails.find((e) => e.to === "parent@example.test");
    const toPupil = fake.emails.find((e) => e.to === "eleve1@example.test");
    expect(toParent?.text).toContain("Élève Un");
    expect(toParent?.text).toContain("votre part");
    expect(toParent?.unsubscribeUrl).toContain(
      "/api/notifications/unsubscribe/",
    );
    expect(toPupil?.text).toContain("Un exercice t'attend");
    expect(looksCommercial(toPupil?.text ?? "")).toBe(false);
    // Un autre élève n'a rien reçu ; un second passage ne renvoie rien.
    expect(await deliveries(s.db, s.ids.other)).toEqual([]);
    expect(await runNotifications(deps, NOON)).toMatchObject({
      queued: 0,
      sent: 0,
    });
    expect(fake.emails).toHaveLength(2);
    // Journal des envois visible par la personne.
    const log = field(
      (await s.parent.get("/notifications")).json,
      "deliveries",
    );
    expect(Array.isArray(log) && log[0]).toMatchObject({
      kind: "nudge",
      channel: "email",
      status: "sent",
    });
  });

  it("par défaut, dans l'application seulement (rien ne part) ; « off » : rien du tout", async () => {
    const s = await setup();
    const fake = fakeSenders();
    await s.parent.put("/notifications", { nudgeChannel: "off" });
    await createNudgeStore(s.db).create({
      learnerId: asLearnerId(s.ids.pupil),
      day: "2026-11-03",
      reason: "finish_exercise",
      notionId: null,
      content: "Un exercice t'attend. On le termine ensemble ?",
      createdAt: NOON,
    });
    await runNotifications(
      { db: s.db, senders: fake.senders, secret: SECRET, publicUrl: WEB },
      NOON,
    );
    expect(fake.emails).toEqual([]);
    expect(await deliveries(s.db, s.ids.pupil)).toMatchObject([
      { kind: "nudge", channel: "app", status: "sent" },
    ]);
    expect(await deliveries(s.db, s.ids.parent)).toEqual([]);
  });

  it("heures calmes dans le fuseau du parent : attend 8 h locales", async () => {
    const s = await setup();
    const fake = fakeSenders();
    await addPhone(s.db, s.ids.parent);
    await s.parent.put("/notifications", {
      nudgeChannel: "sms",
      timeZone: "Africa/Porto-Novo",
    });
    const night = new Date("2026-11-03T22:30:00Z"); // 23 h 30 à Porto-Novo
    await createNudgeStore(s.db).create({
      learnerId: asLearnerId(s.ids.pupil),
      day: "2026-11-03",
      reason: "finish_exercise",
      notionId: null,
      content: "Un exercice t'attend. On le termine ensemble ?",
      createdAt: night,
    });
    const deps = {
      db: s.db,
      senders: fake.senders,
      secret: SECRET,
      publicUrl: WEB,
    };
    await runNotifications(deps, night);
    expect(fake.texts).toEqual([]);
    expect(await deliveries(s.db, s.ids.parent)).toMatchObject([
      { channel: "sms", status: "pending" },
    ]);
    await sendDueNotifications(deps, new Date("2026-11-04T06:59:00Z"));
    expect(fake.texts).toEqual([]);
    await sendDueNotifications(deps, new Date("2026-11-04T07:00:00Z"));
    expect(fake.texts).toHaveLength(1);
    expect(fake.texts[0]?.body).toContain("Ne plus recevoir");
    expect(await deliveries(s.db, s.ids.parent)).toMatchObject([
      { channel: "sms", status: "sent" },
    ]);
  });

  it("changement d'avis avant l'envoi : annulé ; prestataire absent : échec noté", async () => {
    const s = await setup();
    const fake = fakeSenders();
    await s.parent.put("/notifications", {
      nudgeChannel: "email",
      timeZone: "UTC",
    });
    await s.pupil.put("/notifications", { nudgeChannel: "email" });
    const night = new Date("2026-11-03T23:00:00Z");
    await createNudgeStore(s.db).create({
      learnerId: asLearnerId(s.ids.pupil),
      day: "2026-11-03",
      reason: "finish_exercise",
      notionId: null,
      content: "Un exercice t'attend. On le termine ensemble ?",
      createdAt: night,
    });
    const deps = {
      db: s.db,
      senders: { ...fake.senders, email: null },
      secret: SECRET,
      publicUrl: WEB,
    };
    await runNotifications(deps, night);
    await s.parent.put("/notifications", { nudgeChannel: "app" });
    await sendDueNotifications(deps, new Date("2026-11-04T09:00:00Z"));
    expect(await deliveries(s.db, s.ids.parent)).toMatchObject([
      { status: "cancelled", last_error: "preference_changed" },
    ]);
    expect(await deliveries(s.db, s.ids.pupil)).toMatchObject([
      { status: "failed", last_error: "channel_unavailable" },
    ]);
  });
});

describe("nouveaux messages : notification regroupée", () => {
  it("une notification pour plusieurs messages, après un délai, au plus une par heure", async () => {
    const s = await setup();
    const fake = fakeSenders();
    // Pas d'heures calmes : le test ne dépend pas de l'heure à laquelle il tourne.
    await s.pupil.put("/notifications", {
      messageChannel: "email",
      quietStart: 0,
      quietEnd: 0,
    });
    const send = (body: string) =>
      s.prof.post("/messages/send", {
        to: { kind: "user", userId: s.ids.pupil },
        body,
      });
    await send("Bonjour");
    await send("As-tu vu le devoir ?");
    await send("Bon courage !");
    const deps = {
      db: s.db,
      senders: fake.senders,
      secret: SECRET,
      publicUrl: WEB,
    };
    const t0 = Date.now();
    const at = (minutes: number) => new Date(t0 + minutes * 60_000);

    await runNotifications(deps, at(0));
    expect(fake.emails).toEqual([]); // trop tôt : il lit peut-être déjà
    await runNotifications(deps, at(11));
    expect(fake.emails).toHaveLength(1);
    expect(fake.emails[0]?.text).toContain("Tu as 3 nouveaux messages");
    // Aucun contenu ni auteur des messages dans la notification.
    expect(fake.emails[0]?.text).not.toContain("devoir");
    expect(fake.emails[0]?.text).not.toContain("Prof Un");

    await send("Encore un");
    await runNotifications(deps, at(30));
    expect(fake.emails).toHaveLength(1); // moins d'une heure depuis la dernière
    await runNotifications(deps, at(75));
    expect(fake.emails).toHaveLength(2);
    expect(fake.emails[1]?.text).toContain("Tu as un nouveau message");
    // L'expéditeur n'est pas prévenu de ses propres messages.
    expect(await deliveries(s.db, s.ids.prof)).toEqual([]);
  });

  it("messages déjà lus, ou canal « app » : rien n'est envoyé", async () => {
    const s = await setup();
    const fake = fakeSenders();
    await s.pupil.put("/notifications", {
      messageChannel: "email",
      quietStart: 0,
      quietEnd: 0,
    });
    const sent = await s.prof.post("/messages/send", {
      to: { kind: "user", userId: s.ids.pupil },
      body: "Bonjour",
    });
    const threadId = text(sent.json, "threadId");
    await s.prof.post("/messages/send", {
      to: { kind: "user", userId: s.ids.parent },
      body: "Bonjour",
    });
    await s.pupil.post(`/messages/threads/${threadId}/read`);
    await runNotifications(
      { db: s.db, senders: fake.senders, secret: SECRET, publicUrl: WEB },
      new Date(Date.now() + 20 * 60_000),
    );
    expect(fake.emails).toEqual([]); // l'élève a lu, le parent est en « app »
  });
});

describe("notifications push (canal « app »)", () => {
  const NOON = new Date("2026-11-03T12:00:00Z");
  const A = "ExponentPushToken[appareil-a]";
  const B = "ExponentPushToken[appareil-b]";

  /** Faux service push : A accepté, B désinstallé ; reçus réglables. */
  function fakePush() {
    const sent: PushMessage[] = [];
    const receipts = new Map<string, PushReceipt>();
    const push: PushSender = {
      provider: "expo",
      async send(messages) {
        sent.push(...messages);
        return ok(
          messages.map((m) =>
            m.to === B
              ? { to: m.to, ok: false as const, error: "DeviceNotRegistered" }
              : { to: m.to, ok: true as const, id: `ticket-${m.to}` },
          ),
        );
      },
      async receipts(ids) {
        return ok(new Map([...receipts].filter(([id]) => ids.includes(id))));
      },
    };
    return { push, sent, receipts };
  }

  const tokens = async (db: Awaited<ReturnType<typeof setup>>["db"]) =>
    (
      await db.query<{ token: string }>(
        "SELECT token FROM push_tokens ORDER BY token",
      )
    ).rows.map((r) => r.token);

  it("relance dans l'application : push aux appareils, jeton refusé retiré, reçus lus", async () => {
    const s = await setup();
    const fake = fakeSenders();
    const p = fakePush();
    for (const token of [A, B])
      expect(
        (await s.pupil.post("/me/push-tokens", { token, platform: "ios" }))
          .status,
      ).toBe(201);
    await createNudgeStore(s.db).create({
      learnerId: asLearnerId(s.ids.pupil),
      day: "2026-11-03",
      reason: "finish_exercise",
      notionId: null,
      content: "Un exercice t'attend.",
      createdAt: NOON,
    });
    const deps = {
      db: s.db,
      senders: { ...fake.senders, push: p.push },
      secret: SECRET,
      publicUrl: WEB,
    };
    expect(await runNotifications(deps, NOON)).toMatchObject({ sent: 2 });
    // Le parent n'a pas d'appareil : rien n'est poussé pour lui.
    expect(p.sent.map((m) => m.to).sort()).toEqual([A, B]);
    expect(p.sent[0]?.body).toBe("Un exercice t'attend.");
    expect(await tokens(s.db)).toEqual([A]);
    expect(await deliveries(s.db, s.ids.pupil)).toMatchObject([
      { kind: "nudge", channel: "app", status: "sent" },
    ]);

    // Reçu pas encore prêt : le ticket attend ; puis l'appareil A est désinstallé.
    const later = new Date(NOON.getTime() + 20 * 60_000);
    expect(await checkPushReceipts(deps, later)).toEqual({
      checked: 0,
      forgotten: 0,
    });
    p.receipts.set(`ticket-${A}`, { ok: false, error: "DeviceNotRegistered" });
    expect(await checkPushReceipts(deps, later)).toEqual({
      checked: 1,
      forgotten: 1,
    });
    expect(await tokens(s.db)).toEqual([]);
    const left = await s.db.query("SELECT 1 FROM push_receipts");
    expect(left.rows).toHaveLength(0);
  });

  it("messages non lus : notification regroupée par push si un appareil est enregistré", async () => {
    const s = await setup();
    const p = fakePush();
    await s.pupil.put("/notifications", { quietStart: 0, quietEnd: 0 });
    await s.pupil.post("/me/push-tokens", { token: A, platform: "android" });
    await s.prof.post("/messages/send", {
      to: { kind: "user", userId: s.ids.pupil },
      body: "Bonjour",
    });
    await runNotifications(
      {
        db: s.db,
        senders: { ...fakeSenders().senders, push: p.push },
        secret: SECRET,
        publicUrl: WEB,
      },
      new Date(Date.now() + 11 * 60_000),
    );
    expect(p.sent.map((m) => [m.to, m.body])).toEqual([
      [A, "Tu as un nouveau message sur Wema."],
    ]);
    // Le prof, sans appareil ni canal hors de l'application, n'a rien.
    expect(await deliveries(s.db, s.ids.prof)).toEqual([]);
  });
});
