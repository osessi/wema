import { describe, expect, it } from "vitest";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

const PASSWORD = "mot-de-passe-de-test-1";

/**
 * Collège avec deux classes : 4e A (Prof Un, Élève Un, Élève Deux) et 4e B
 * (Prof Deux, Élève Trois). Famille : Parent suit Élève Un. Une autre famille :
 * Parent Autre, sans enfant dans ces classes.
 */
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
    const id = text(
      (await dir.post(`/admin/organizations/${school}/classes`, { name })).json,
      "id",
    );
    for (const [userId, r] of members)
      await dir.post(`/admin/classes/${id}/members`, { userId, role: r });
    return id;
  };
  const classA = await klass("4e A", [
    [prof1, "teacher"],
    [pupil1, "learner"],
    [pupil2, "learner"],
  ]);
  const classB = await klass("4e B", [
    [prof2, "teacher"],
    [pupil3, "learner"],
  ]);

  return {
    ...server,
    admin,
    dir,
    family,
    classA,
    classB,
    ids: { prof1, prof2, pupil1, pupil2, pupil3, parent },
    p1: await login("prof1@example.test"),
    p2: await login("prof2@example.test"),
    e1: await login("eleve1@example.test"),
    e2: await login("eleve2@example.test"),
    e3: await login("eleve3@example.test"),
    parent: await login("parent@example.test"),
    stranger: await login("autre@example.test"),
  };
}

type Browser = ReturnType<typeof browser>;

const contactIds = async (b: Browser) => {
  const list = field((await b.get("/messages/contacts")).json, "contacts");
  return Array.isArray(list)
    ? list.map((c: unknown) => field(c, "userId")).sort()
    : null;
};
const toUser = (b: Browser, userId: string, body = "Bonjour") =>
  b.post("/messages/send", { to: { kind: "user", userId }, body });
const threads = async (b: Browser) => {
  const json = (await b.get("/messages/threads")).json;
  const list = field(json, "threads");
  return {
    list: Array.isArray(list) ? list : [],
    unread: field(json, "unreadTotal"),
  };
};

describe("messagerie : qui peut écrire à qui", () => {
  it("contacts : prof ↔ élèves de ses classes et leurs parents ; élève → ses profs ; parent → profs de son enfant", async () => {
    const s = await setup();
    const { prof1, prof2, pupil1, pupil2, pupil3, parent } = s.ids;
    expect(await contactIds(s.p1)).toEqual([pupil1, pupil2, parent].sort());
    expect(await contactIds(s.p2)).toEqual([pupil3]);
    expect(await contactIds(s.e1)).toEqual([prof1]);
    expect(await contactIds(s.e3)).toEqual([prof2]);
    expect(await contactIds(s.parent)).toEqual([prof1]);
    expect(await contactIds(s.stranger)).toEqual([]);

    // Le lien prof ↔ parent passe par l'enfant, et il est expliqué.
    const contacts = field(
      (await s.p1.get("/messages/contacts")).json,
      "contacts",
    );
    const parentEntry = Array.isArray(contacts)
      ? contacts.find((c: unknown) => field(c, "userId") === parent)
      : null;
    expect(field(parentEntry, "links")).toEqual([
      { relation: "guardian", className: "4e A", childName: "Élève Un" },
    ]);
    expect(
      field((await s.p1.get("/messages/contacts")).json, "classes"),
    ).toEqual([{ id: s.classA, name: "4e A" }]);
    expect(
      field((await s.e1.get("/messages/contacts")).json, "classes"),
    ).toEqual([]);
  });

  it("mineurs : un élève n'écrit ni à un autre élève, ni à un adulte sans lien", async () => {
    const s = await setup();
    const { prof2, pupil2, pupil3, parent } = s.ids;
    expect((await toUser(s.e1, pupil2)).status).toBe(403);
    expect((await toUser(s.e1, pupil3)).status).toBe(403);
    expect((await toUser(s.e1, prof2)).status).toBe(403);
    expect((await toUser(s.e1, parent)).status).toBe(403);
    expect((await toUser(s.e1, s.ids.pupil1)).status).toBe(403);
    // Et un adulte sans lien ne peut pas lui écrire non plus.
    expect((await toUser(s.p2, s.ids.pupil1)).status).toBe(403);
    expect((await toUser(s.stranger, s.ids.pupil1)).status).toBe(403);
    expect((await toUser(s.parent, pupil2)).status).toBe(403);
    expect((await threads(s.e1)).list).toEqual([]);
  });

  it("parents : un parent n'écrit qu'aux profs de son enfant", async () => {
    const s = await setup();
    expect((await toUser(s.parent, s.ids.prof2)).status).toBe(403);
    expect((await toUser(s.stranger, s.ids.prof1)).status).toBe(403);
    expect((await toUser(s.p2, s.ids.parent)).status).toBe(403);
    expect((await toUser(s.parent, s.ids.prof1)).status).toBe(201);
    expect((await toUser(s.p1, s.ids.parent, "Réponse")).status).toBe(201);
    const { list } = await threads(s.parent);
    expect(list.length).toBe(1);
    expect(field(list[0], "otherName")).toBe("Prof Un");
    expect(field(list[0], "unread")).toBe(1);
  });

  it("échange prof ↔ élève : un seul fil, non-lus, lecture, réponse", async () => {
    const s = await setup();
    const first = await toUser(s.p1, s.ids.pupil1, "Pense à ton devoir");
    expect(first.status).toBe(201);
    const threadId = text(first.json, "threadId");
    // Un second message par « nouveau message » retombe dans le même fil.
    expect(
      text(
        (await toUser(s.p1, s.ids.pupil1, "Et relis la leçon")).json,
        "threadId",
      ),
    ).toBe(threadId);

    const e1 = await threads(s.e1);
    expect(e1.unread).toBe(2);
    expect(field(e1.list[0], "otherName")).toBe("Prof Un");
    expect(field(e1.list[0], "canWrite")).toBe(true);
    expect(field(e1.list[0], "lastMessage", "body")).toBe("Et relis la leçon");
    expect((await threads(s.p1)).unread).toBe(0);

    const read = await s.e1.get(`/messages/threads/${threadId}`);
    expect(read.status).toBe(200);
    const msgs = field(read.json, "messages");
    expect(
      Array.isArray(msgs) &&
        msgs.map((m: unknown) => [field(m, "body"), field(m, "mine")]),
    ).toEqual([
      ["Pense à ton devoir", false],
      ["Et relis la leçon", false],
    ]);
    expect((await s.e1.post(`/messages/threads/${threadId}/read`)).status).toBe(
      200,
    );
    expect((await threads(s.e1)).unread).toBe(0);

    const reply = await s.e1.post(`/messages/threads/${threadId}/messages`, {
      body: "D'accord, merci !",
    });
    expect(reply.status).toBe(201);
    expect((await threads(s.e1)).unread).toBe(0);
    expect((await threads(s.p1)).unread).toBe(1);

    // Personne d'autre ne voit ce fil.
    for (const other of [s.p2, s.e2, s.parent, s.stranger]) {
      expect((await other.get(`/messages/threads/${threadId}`)).status).toBe(
        404,
      );
      expect(
        (
          await other.post(`/messages/threads/${threadId}/messages`, {
            body: "intrus",
          })
        ).status,
      ).toBe(404);
      expect(
        (await other.post(`/messages/threads/${threadId}/read`)).status,
      ).toBe(404);
      expect((await threads(other)).list).toEqual([]);
    }

    // Message vide ou trop long : refusé.
    expect(
      (
        await s.e1.post(`/messages/threads/${threadId}/messages`, {
          body: "  ",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await s.e1.post(`/messages/threads/${threadId}/messages`, {
          body: "x".repeat(4001),
        })
      ).status,
    ).toBe(400);
  });

  it("annonces de classe : seul le prof écrit, seuls les membres lisent", async () => {
    const s = await setup();
    const toClass = (b: Browser, classId: string) =>
      b.post("/messages/send", {
        to: { kind: "class", classId },
        body: "Contrôle vendredi",
      });
    expect((await toClass(s.e1, s.classA)).status).toBe(403);
    expect((await toClass(s.p2, s.classA)).status).toBe(403);
    expect((await toClass(s.parent, s.classA)).status).toBe(403);
    const sent = await toClass(s.p1, s.classA);
    expect(sent.status).toBe(201);
    const threadId = text(sent.json, "threadId");

    for (const pupil of [s.e1, s.e2]) {
      const { list, unread } = await threads(pupil);
      expect(unread).toBe(1);
      expect(field(list[0], "kind")).toBe("class");
      expect(field(list[0], "className")).toBe("4e A");
      expect(field(list[0], "canWrite")).toBe(false);
    }
    expect(
      (
        await s.e1.post(`/messages/threads/${threadId}/messages`, {
          body: "Moi aussi",
        })
      ).status,
    ).toBe(403);
    expect((await s.e3.get(`/messages/threads/${threadId}`)).status).toBe(404);
    expect((await s.p2.get(`/messages/threads/${threadId}`)).status).toBe(404);
    expect(
      field(
        (await s.p1.get(`/messages/threads/${threadId}`)).json,
        "thread",
        "canWrite",
      ),
    ).toBe(true);
  });

  it("un lien perdu ferme l'écriture (et la lecture des annonces)", async () => {
    const s = await setup();
    const t2 = text((await toUser(s.p1, s.ids.pupil2)).json, "threadId");
    const tParent = text((await toUser(s.p1, s.ids.parent)).json, "threadId");
    const tClass = text(
      (
        await s.p1.post("/messages/send", {
          to: { kind: "class", classId: s.classA },
          body: "Annonce",
        })
      ).json,
      "threadId",
    );

    // Élève Deux sort de la classe.
    await s.dir.delete(`/admin/classes/${s.classA}/members/${s.ids.pupil2}`);
    expect(
      (await s.p1.post(`/messages/threads/${t2}/messages`, { body: "Encore" }))
        .status,
    ).toBe(403);
    expect(
      (await s.e2.post(`/messages/threads/${t2}/messages`, { body: "Re" }))
        .status,
    ).toBe(403);
    // L'historique du fil direct reste lisible, sans possibilité d'écrire.
    const old = await s.e2.get(`/messages/threads/${t2}`);
    expect(old.status).toBe(200);
    expect(field(old.json, "thread", "canWrite")).toBe(false);
    expect((await s.e2.get(`/messages/threads/${tClass}`)).status).toBe(404);

    // Le parent est délié : il ne peut plus écrire au prof.
    await s.admin.delete(
      `/admin/organizations/${s.family}/guardianships/${s.ids.parent}/${s.ids.pupil1}`,
    );
    expect(
      (
        await s.parent.post(`/messages/threads/${tParent}/messages`, {
          body: "?",
        })
      ).status,
    ).toBe(403);
    expect((await toUser(s.parent, s.ids.prof1)).status).toBe(403);
    expect(await contactIds(s.p1)).toEqual([s.ids.pupil1]);
  });

  it("sans session : 401", async () => {
    const s = await setup();
    const anon = browser(s.app);
    expect((await anon.get("/messages/threads")).status).toBe(401);
    expect((await anon.get("/messages/contacts")).status).toBe(401);
  });
});
