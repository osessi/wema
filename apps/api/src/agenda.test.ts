import { createEventStore } from "@wema/db";
import { asLearnerId, ok } from "@wema/domain";
import { describe, expect, it } from "vitest";
import type { EmailMessage, Senders } from "./notify/channels";
import { runNotifications } from "./notify/dispatch";
import {
  type AgendaReminder,
  runAgendaReminders,
  visioDomain,
} from "./routes/agenda";
import { ADMIN, browser, field, testServer, text, WEB } from "./test-helpers";

const PASSWORD = "mot-de-passe-de-test-1";

/**
 * Collège : 4e A (Prof Un, Élève Un, Élève Deux) et 4e B (Prof Deux, Élève
 * Trois), au programme d'une notion « fractions ». Famille : Parent suit
 * Élève Un. Parent Autre n'a aucun enfant dans ces classes.
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
  const fractions = await id(
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
  const prof1 = await member(school, profRole, "Prof Un", "prof1@example.test");
  const prof2 = await member(
    school,
    profRole,
    "Prof Deux",
    "prof2@example.test",
  );
  const pupil1 = await member(
    school,
    pupilRole,
    "Élève Un",
    "eleve1@example.test",
  );
  const pupil2 = await member(
    school,
    pupilRole,
    "Élève Deux",
    "eleve2@example.test",
  );
  const pupil3 = await member(
    school,
    pupilRole,
    "Élève Trois",
    "eleve3@example.test",
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
    learnerId: pupil1,
  });
  const otherFamily = await org("Autre famille", "family");
  const otherRole = await role(otherFamily, "Parent", ["learners.read"]);
  await member(otherFamily, otherRole, "Parent Autre", "autre@example.test");

  const login = async (email: string) => {
    const b = browser(server.app);
    await b.post("/auth/login", { email, password: PASSWORD });
    return b;
  };
  const dir = await login("direction@example.test");
  const klass = async (name: string, members: [string, string][]) => {
    const classId = await id(
      dir.post(`/admin/organizations/${school}/classes`, { name, programId }),
    );
    for (const [userId, r] of members)
      await dir.post(`/admin/classes/${classId}/members`, { userId, role: r });
    return classId;
  };
  const classA = await klass("4e A", [
    [prof1, "teacher"],
    [pupil1, "learner"],
    [pupil2, "learner"],
  ]);
  await klass("4e B", [
    [prof2, "teacher"],
    [pupil3, "learner"],
  ]);

  return {
    ...server,
    classA,
    fractions,
    ids: { prof1, prof2, pupil1, pupil2, pupil3, parent },
    dir,
    p1: await login("prof1@example.test"),
    p2: await login("prof2@example.test"),
    e1: await login("eleve1@example.test"),
    e2: await login("eleve2@example.test"),
    e3: await login("eleve3@example.test"),
    parent: await login("parent@example.test"),
    stranger: await login("autre@example.test"),
  };
}

type Setup = Awaited<ReturnType<typeof setup>>;
type Browser = Setup["p1"];

const DAY = 86_400_000;
const HOUR = 3_600_000;
/** Demain à l'heure UTC donnée. */
function tomorrowAt(hour: number, minute = 0): Date {
  const d = new Date(Date.now() + DAY);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}
const today = () => new Date().toISOString().slice(0, 10);

/** Prof Un disponible tous les jours de 8 h à 20 h UTC, créneaux d'une heure. */
async function openAvailability(
  b: Browser,
  extra: Record<string, unknown> = {},
) {
  return b.post("/agenda/availability", {
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    startTime: "08:00",
    endTime: "20:00",
    timeZone: "UTC",
    validFrom: today(),
    validUntil: null,
    everyNWeeks: 1,
    slotMinutes: 60,
    ...extra,
  });
}

function book(
  b: Browser,
  s: Setup,
  start: Date,
  learnerId = s.ids.pupil1,
  teacherId = s.ids.prof1,
) {
  return b.post("/agenda/bookings", {
    teacherId,
    learnerId,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + HOUR).toISOString(),
    note: "Revoir les fractions",
  });
}

const list = (json: unknown, key: string): unknown[] => {
  const v = field(json, key);
  return Array.isArray(v) ? v : [];
};

describe("agenda : droits de réservation", () => {
  it("le parent réserve auprès des profs de son enfant, et de personne d'autre", async () => {
    const s = await setup();
    expect((await openAvailability(s.p1)).status).toBe(201);
    expect((await openAvailability(s.p2)).status).toBe(201);

    const bookable = list(
      (await s.parent.get("/agenda/family?space=guardian")).json,
      "bookable",
    );
    expect(
      bookable.map((b) => [
        field(b, "teacherId"),
        field(b, "learnerId"),
        field(b, "via"),
      ]),
    ).toEqual([[s.ids.prof1, s.ids.pupil1, "guardian"]]);

    // Pas le prof d'une autre classe, pas un autre enfant, pas un inconnu.
    expect(
      (await book(s.parent, s, tomorrowAt(10), s.ids.pupil1, s.ids.prof2))
        .status,
    ).toBe(403);
    expect((await book(s.parent, s, tomorrowAt(10), s.ids.pupil2)).status).toBe(
      403,
    );
    expect((await book(s.stranger, s, tomorrowAt(10))).status).toBe(403);
    // Un élève suivi par un parent passe par lui.
    expect((await book(s.e1, s, tomorrowAt(10))).status).toBe(403);
    // Un prof ne réserve pas pour un élève : il planifie.
    expect((await book(s.p1, s, tomorrowAt(10))).status).toBe(403);

    expect((await book(s.parent, s, tomorrowAt(10))).status).toBe(201);
  });

  it("un élève sans parent lié réserve lui-même auprès de ses profs", async () => {
    const s = await setup();
    await openAvailability(s.p1);
    const bookable = list(
      (await s.e2.get("/agenda/family?space=learner")).json,
      "bookable",
    );
    expect(bookable.map((b) => field(b, "via"))).toEqual(["self"]);
    expect((await book(s.e2, s, tomorrowAt(11), s.ids.pupil2)).status).toBe(
      201,
    );
    expect((await book(s.e2, s, tomorrowAt(12), s.ids.pupil1)).status).toBe(
      403,
    );
  });

  it("les créneaux libres ne se lisent que pour un lien réel", async () => {
    const s = await setup();
    await openAvailability(s.p1);
    const from = tomorrowAt(0).toISOString();
    const to = new Date(tomorrowAt(0).getTime() + DAY).toISOString();
    const q = (t: string, l: string) =>
      `/agenda/slots?teacherId=${t}&learnerId=${l}&from=${from}&to=${to}`;
    const ok = await s.parent.get(q(s.ids.prof1, s.ids.pupil1));
    expect(ok.status).toBe(200);
    expect(list(ok.json, "slots")).toHaveLength(12);
    expect((await s.stranger.get(q(s.ids.prof1, s.ids.pupil1))).status).toBe(
      403,
    );
    expect((await s.parent.get(q(s.ids.prof2, s.ids.pupil1))).status).toBe(403);
  });

  it("le prof ne planifie qu'avec ses élèves, et ne gère que ses disponibilités", async () => {
    const s = await setup();
    const plan = (b: Browser, learnerId: string) =>
      b.post("/agenda/sessions", {
        target: { kind: "individual", learnerId },
        title: "Soutien",
        startsAt: tomorrowAt(15).toISOString(),
        endsAt: tomorrowAt(16).toISOString(),
      });
    expect((await plan(s.p1, s.ids.pupil3)).status).toBe(403);
    expect((await plan(s.parent, s.ids.pupil1)).status).toBe(403);
    expect((await plan(s.p1, s.ids.pupil1)).status).toBe(201);

    const rule = text((await openAvailability(s.p1)).json, "id");
    expect((await s.p2.delete(`/agenda/availability/${rule}`)).status).toBe(
      404,
    );
    expect((await s.p1.delete(`/agenda/availability/${rule}`)).status).toBe(
      200,
    );
  });
});

describe("agenda : conflits et horaires", () => {
  it("refuse un créneau hors disponibilité, déjà pris, ou passé", async () => {
    const s = await setup();
    await openAvailability(s.p1);
    // 21 h UTC : hors de la plage 8 h – 20 h.
    expect(
      field((await book(s.parent, s, tomorrowAt(21))).json, "error", "code"),
    ).toBe("slot_unavailable");
    // À cheval sur la fin de la plage.
    expect((await book(s.parent, s, tomorrowAt(19, 30))).status).toBe(409);
    expect((await book(s.parent, s, tomorrowAt(10))).status).toBe(201);
    // Même créneau, ou chevauchement partiel : le prof est pris.
    const again = await book(s.e2, s, tomorrowAt(10, 30), s.ids.pupil2);
    expect(again.status).toBe(409);
    expect(field(again.json, "error", "code")).toBe("teacher_busy");
    // Bord à bord : accepté.
    expect((await book(s.e2, s, tomorrowAt(11), s.ids.pupil2)).status).toBe(
      201,
    );
    // Dans le passé.
    const past = new Date(Date.now() - DAY);
    expect((await book(s.parent, s, past)).status).toBe(400);
  });

  it("un élève déjà en séance avec un autre prof n'est pas libre", async () => {
    const s = await setup();
    // Prof Deux enseigne aussi en 4e A : Élève Un a deux profs.
    await s.dir.post(`/admin/classes/${s.classA}/members`, {
      userId: s.ids.prof2,
      role: "teacher",
    });
    await openAvailability(s.p1);
    await openAvailability(s.p2);
    expect((await book(s.parent, s, tomorrowAt(10))).status).toBe(201);
    const other = await book(
      s.parent,
      s,
      tomorrowAt(10),
      s.ids.pupil1,
      s.ids.prof2,
    );
    expect(field(other.json, "error", "code")).toBe("learner_busy");
  });

  it("une disponibilité suit le fuseau du prof", async () => {
    const s = await setup();
    // 17 h – 19 h à Paris : 15 h ou 16 h UTC selon la saison.
    await openAvailability(s.p1, {
      startTime: "17:00",
      endTime: "19:00",
      timeZone: "Europe/Paris",
    });
    const from = tomorrowAt(0);
    const res = await s.parent.get(
      `/agenda/slots?teacherId=${s.ids.prof1}&learnerId=${s.ids.pupil1}&from=${from.toISOString()}&to=${new Date(from.getTime() + DAY).toISOString()}`,
    );
    const starts = list(res.json, "slots").map((x) =>
      String(field(x, "start")),
    );
    const local = starts.map((iso) =>
      new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso)),
    );
    expect(local).toEqual(["17:00", "18:00"]);
    expect(
      (await openAvailability(s.p1, { timeZone: "Mars/Olympus" })).status,
    ).toBe(400);
  });
});

describe("agenda : cycle d'une séance", () => {
  it("demande → autre horaire proposé → accepté par le parent → visio → compte rendu", async () => {
    const s = await setup();
    await openAvailability(s.p1);
    const sessionId = text(
      (await book(s.parent, s, tomorrowAt(10))).json,
      "id",
    );

    // Le prof voit la demande et propose 14 h.
    const pending = list((await s.p1.get("/agenda/teacher")).json, "pending");
    expect(pending.map((p) => field(p, "id"))).toEqual([sessionId]);
    // Ni l'élève (suivi par un parent) ni un inconnu ne décident.
    expect(
      (await s.e1.post(`/agenda/sessions/${sessionId}/confirm`)).status,
    ).toBe(403);
    expect((await s.stranger.get(`/agenda/sessions/${sessionId}`)).status).toBe(
      404,
    );
    expect((await s.p2.get(`/agenda/sessions/${sessionId}`)).status).toBe(404);
    expect(
      (
        await s.p1.post(`/agenda/sessions/${sessionId}/reschedule`, {
          startsAt: tomorrowAt(14).toISOString(),
          endsAt: tomorrowAt(15).toISOString(),
        })
      ).status,
    ).toBe(200);
    let detail = (await s.parent.get(`/agenda/sessions/${sessionId}`)).json;
    expect(field(detail, "session", "status")).toBe("proposed");
    expect(field(detail, "can", "accept")).toBe(true);
    expect(field(detail, "visio")).toBeNull();

    expect(
      (await s.parent.post(`/agenda/sessions/${sessionId}/accept`)).status,
    ).toBe(200);
    // Deux fois : la séance a déjà changé.
    expect(
      (await s.parent.post(`/agenda/sessions/${sessionId}/accept`)).status,
    ).toBe(409);

    // L'élève voit sa séance et la salle de visio, au nom non devinable.
    detail = (await s.e1.get(`/agenda/sessions/${sessionId}`)).json;
    expect(field(detail, "role")).toBe("learner");
    const room = text(detail, "visio", "room");
    expect(room).toMatch(/^wema-[A-Za-z0-9_-]{24}$/);
    expect(text(detail, "visio", "url")).toBe(`https://meet.jit.si/${room}`);
    expect(field(detail, "can", "cancel")).toBe(false);

    // Agendas : le prof, l'élève et le parent la voient ; l'autre élève non.
    const range = `from=${tomorrowAt(0).toISOString()}&to=${new Date(tomorrowAt(0).getTime() + DAY).toISOString()}`;
    for (const [b, space] of [
      [s.p1, "teacher"],
      [s.e1, "learner"],
      [s.parent, "guardian"],
    ] as const) {
      const cal = (await b.get(`/agenda/calendar?space=${space}&${range}`))
        .json;
      expect(list(cal, "sessions").map((x) => field(x, "id"))).toEqual([
        sessionId,
      ]);
    }
    expect(
      list(
        (await s.e2.get(`/agenda/calendar?space=learner&${range}`)).json,
        "sessions",
      ),
    ).toEqual([]);

    // Pas de compte rendu avant la fin.
    const report = {
      summary: "Addition de fractions de dénominateurs différents.",
      notionIds: [s.fractions],
    };
    expect(
      (await s.p1.post(`/agenda/sessions/${sessionId}/report`, report)).status,
    ).toBe(409);
    await s.db.query(
      "UPDATE tutoring_sessions SET starts_at = starts_at - interval '3 days', ends_at = ends_at - interval '3 days' WHERE id = $1",
      [sessionId],
    );
    expect(
      (await s.parent.post(`/agenda/sessions/${sessionId}/report`, report))
        .status,
    ).toBe(403);
    expect(
      (
        await s.p1.post(`/agenda/sessions/${sessionId}/report`, {
          ...report,
          notionIds: ["00000000-0000-4000-8000-000000000000"],
        })
      ).status,
    ).toBe(400);
    expect(
      (await s.p1.post(`/agenda/sessions/${sessionId}/report`, report)).status,
    ).toBe(200);

    // Le compte rendu est visible du parent et entre au journal (source « teacher »).
    detail = (await s.parent.get(`/agenda/sessions/${sessionId}`)).json;
    expect(field(detail, "session", "status")).toBe("done");
    expect(field(detail, "session", "report", "notions")).toEqual([
      { id: s.fractions, name: "Fractions" },
    ]);
    const events = await createEventStore(s.db).listByLearner(
      asLearnerId(s.ids.pupil1),
    );
    const reported = events.filter(
      (e) => e.payload.type === "session.reported",
    );
    expect(reported).toHaveLength(1);
    expect(reported[0]?.source).toBe("teacher");
  });

  it("groupe de révision : élèves de ses classes seulement, séance commune, compte rendu pour chacun", async () => {
    const s = await setup();
    const make = (b: Browser, learnerIds: string[]) =>
      b.post("/agenda/groups", {
        name: "Révision fractions",
        notionId: s.fractions,
        learnerIds,
      });
    expect((await make(s.p1, [s.ids.pupil1, s.ids.pupil3])).status).toBe(403);
    const groupId = text(
      (await make(s.p1, [s.ids.pupil1, s.ids.pupil2])).json,
      "id",
    );
    const sessionId = text(
      (
        await s.p1.post("/agenda/sessions", {
          target: { kind: "group", groupId },
          title: null,
          startsAt: tomorrowAt(16).toISOString(),
          endsAt: tomorrowAt(17).toISOString(),
        })
      ).json,
      "id",
    );
    // Le prof ne peut pas mettre un membre du groupe dans une autre séance au même moment.
    const clash = await s.p1.post("/agenda/sessions", {
      target: { kind: "individual", learnerId: s.ids.pupil2 },
      title: null,
      startsAt: tomorrowAt(16, 30).toISOString(),
      endsAt: tomorrowAt(17, 30).toISOString(),
    });
    expect(field(clash.json, "error", "code")).toBe("teacher_busy");

    expect(
      field((await s.e2.get(`/agenda/sessions/${sessionId}`)).json, "role"),
    ).toBe("learner");
    expect(
      field((await s.parent.get(`/agenda/sessions/${sessionId}`)).json, "role"),
    ).toBe("guardian");
    expect((await s.e3.get(`/agenda/sessions/${sessionId}`)).status).toBe(404);
    // Une séance de groupe se gère par le prof seul.
    expect(
      (await s.parent.post(`/agenda/sessions/${sessionId}/cancel`)).status,
    ).toBe(403);

    await s.db.query(
      "UPDATE tutoring_sessions SET starts_at = starts_at - interval '3 days', ends_at = ends_at - interval '3 days' WHERE id = $1",
      [sessionId],
    );
    const res = await s.p1.post(`/agenda/sessions/${sessionId}/report`, {
      summary: "Exercices de simplification.",
      notionIds: [s.fractions],
    });
    expect(field(res.json, "learners")).toBe(2);
  });

  it("le prof refuse ; la famille annule ; un créneau annulé redevient libre", async () => {
    const s = await setup();
    await openAvailability(s.p1);
    const first = text((await book(s.parent, s, tomorrowAt(10))).json, "id");
    expect((await s.p1.post(`/agenda/sessions/${first}/decline`)).status).toBe(
      200,
    );
    const second = text((await book(s.parent, s, tomorrowAt(10))).json, "id");
    expect((await s.p1.post(`/agenda/sessions/${second}/confirm`)).status).toBe(
      200,
    );
    expect(
      (await s.parent.post(`/agenda/sessions/${second}/cancel`)).status,
    ).toBe(200);
    expect((await book(s.e2, s, tomorrowAt(10), s.ids.pupil2)).status).toBe(
      201,
    );
  });
});

describe("agenda : rappels et visio", () => {
  it("prépare le rappel 24 h puis 1 h, une seule fois, pour le prof, l'élève et son parent", async () => {
    const s = await setup();
    const start = tomorrowAt(15);
    const sessionId = text(
      (
        await s.p1.post("/agenda/sessions", {
          target: { kind: "individual", learnerId: s.ids.pupil1 },
          title: "Soutien",
          startsAt: start.toISOString(),
          endsAt: new Date(start.getTime() + HOUR).toISOString(),
        })
      ).json,
      "id",
    );
    const sent: AgendaReminder[] = [];
    const sender = {
      async send(r: AgendaReminder) {
        sent.push(r);
      },
    };
    const at = (ms: number) => new Date(start.getTime() - ms);

    expect(await runAgendaReminders(s.db, sender, at(25 * HOUR))).toEqual({
      sent: 0,
      failed: 0,
    });
    await runAgendaReminders(s.db, sender, at(23 * HOUR));
    await runAgendaReminders(s.db, sender, at(22 * HOUR));
    expect(sent.map((r) => r.kind)).toEqual(["24h"]);
    await runAgendaReminders(s.db, sender, at(HOUR / 2));
    await runAgendaReminders(s.db, sender, at(HOUR / 4));
    expect(sent.map((r) => r.kind)).toEqual(["24h", "1h"]);

    const recipients = sent[0]?.recipients ?? [];
    expect(recipients.map((r) => [r.userId, r.role]).sort()).toEqual(
      [
        [s.ids.prof1, "teacher"],
        [s.ids.pupil1, "learner"],
        [s.ids.parent, "guardian"],
      ].sort(),
    );
    expect(recipients.find((r) => r.role === "guardian")?.path).toBe(
      `/parent/agenda/seances/${sessionId}`,
    );
  });

  it("une séance prise tard ne reçoit que le rappel 1 h ; une séance annulée aucun", async () => {
    const s = await setup();
    const start = tomorrowAt(15);
    const plan = async (hour: number) =>
      text(
        (
          await s.p1.post("/agenda/sessions", {
            target: { kind: "individual", learnerId: s.ids.pupil2 },
            title: null,
            startsAt: tomorrowAt(hour).toISOString(),
            endsAt: tomorrowAt(hour + 1).toISOString(),
          })
        ).json,
        "id",
      );
    await plan(15);
    const cancelled = await plan(17);
    await s.p1.post(`/agenda/sessions/${cancelled}/cancel`);
    const sent: AgendaReminder[] = [];
    await runAgendaReminders(
      s.db,
      { send: async (r) => void sent.push(r) },
      new Date(start.getTime() - HOUR / 2),
    );
    expect(sent.map((r) => r.kind)).toEqual(["1h"]);
  });

  it("module d'envoi : rappels selon les préférences, 1 h hors heures calmes, séance annulée", async () => {
    const s = await setup();
    const emails: EmailMessage[] = [];
    const senders: Senders = {
      sms: null,
      whatsapp: null,
      email: {
        provider: "faux",
        send: async (m) => {
          emails.push(m);
          return ok({ provider: "faux", ref: null });
        },
      },
    };
    const deps = {
      db: s.db,
      senders,
      secret: "secret-de-test",
      publicUrl: WEB,
    };
    // Parent : e-mail, fuseau UTC, heures calmes par défaut (21 h - 8 h).
    await s.parent.put("/notifications", { messageChannel: "email" });
    await s.e1.put("/notifications", { messageChannel: "off" });
    const plan = async (hour: number) =>
      text(
        (
          await s.p1.post("/agenda/sessions", {
            target: { kind: "individual", learnerId: s.ids.pupil1 },
            title: "Soutien",
            startsAt: tomorrowAt(hour).toISOString(),
            endsAt: tomorrowAt(hour + 1).toISOString(),
          })
        ).json,
        "id",
      );
    const morning = await plan(7);
    const evening = await plan(22);
    const rows = async (userId: string) =>
      (
        await s.db.query<{
          session_id: string;
          reminder: string;
          channel: string;
          status: string;
          last_error: string | null;
        }>(
          "SELECT session_id, reminder, channel, status, last_error FROM notification_deliveries WHERE user_id = $1 AND kind = 'session_reminder' ORDER BY created_at, reminder",
          [userId],
        )
      ).rows;

    // 24 h avant la séance de 7 h (7 h la veille : heures calmes) : attend 8 h.
    const before = (hour: number, ms: number) =>
      new Date(tomorrowAt(hour).getTime() - ms);
    await runNotifications(deps, before(7, 24 * HOUR));
    expect(emails).toEqual([]);
    await runNotifications(deps, before(7, 23 * HOUR));
    expect(emails.map((e) => e.subject)).toEqual(["Rappel de séance"]);
    expect(emails[0]?.text).toContain("de votre enfant avec Prof Un");
    expect(emails[0]?.text).toContain(`/parent/agenda/seances/${morning}`);
    // Le prof : dans l'application ; l'élève a coupé : rien.
    expect(await rows(s.ids.prof1)).toMatchObject([
      { session_id: morning, reminder: "24h", channel: "app", status: "sent" },
    ]);
    expect(await rows(s.ids.pupil1)).toEqual([]);

    // 1 h avant (6 h 30, heures calmes) : part quand même.
    await runNotifications(deps, before(7, HOUR / 2));
    expect(emails).toHaveLength(2);
    expect(emails[1]?.text).toContain("dans moins d'une heure");

    // Le même passage (6 h 30) a réservé le rappel 24 h de la séance de 22 h :
    // heures calmes, repoussé à 8 h ; la séance est annulée entre-temps.
    expect(
      (await rows(s.ids.parent)).find((r) => r.session_id === evening),
    ).toMatchObject({ reminder: "24h", status: "pending" });
    await s.p1.post(`/agenda/sessions/${evening}/cancel`);
    await runNotifications(deps, before(22, 13 * HOUR));
    expect(emails).toHaveLength(2);
    expect(
      (await rows(s.ids.parent)).find((r) => r.session_id === evening),
    ).toMatchObject({
      status: "cancelled",
      last_error: "session_not_confirmed",
    });
  });

  it("le domaine de visio se règle par variable d'environnement", () => {
    expect(visioDomain({})).toBe("meet.jit.si");
    expect(visioDomain({ WEMA_JITSI_DOMAIN: "visio.example.test" })).toBe(
      "visio.example.test",
    );
    expect(visioDomain({ WEMA_JITSI_DOMAIN: "https://x/y" })).toBe(
      "meet.jit.si",
    );
  });
});
