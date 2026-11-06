// Préparation des données par l'API (comme le ferait le back-office), pour que
// chaque scénario ait ses propres comptes et ne dépende pas des autres.
import { type APIRequestContext, expect, request } from "@playwright/test";
import { ADMIN, API_URL, WEB_URL } from "../env";

/** Suffixe unique (scénarios en parallèle, serveurs réutilisés en local). */
export function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

type Json = Record<string, unknown>;

/** Client de l'API avec sa propre session (cookie). */
export class Api {
  private constructor(readonly ctx: APIRequestContext) {}

  static async anonymous(): Promise<Api> {
    return new Api(
      await request.newContext({
        baseURL: API_URL,
        extraHTTPHeaders: { origin: WEB_URL },
      }),
    );
  }

  static async login(email: string, password: string): Promise<Api> {
    const api = await Api.anonymous();
    await api.post("/api/auth/login", { email, password });
    return api;
  }

  static admin(): Promise<Api> {
    return Api.login(ADMIN.email, ADMIN.password);
  }

  async get(path: string): Promise<Json> {
    const res = await this.ctx.get(path);
    expect(res.status(), `GET ${path}`).toBeLessThan(400);
    return res.json();
  }

  async post(path: string, data?: unknown): Promise<Json> {
    const res = await this.ctx.post(path, data === undefined ? {} : { data });
    expect(res.status(), `POST ${path} : ${await res.text()}`).toBeLessThan(
      400,
    );
    return res.headers()["content-type"]?.includes("json") ? res.json() : {};
  }

  async put(path: string, data: unknown): Promise<Json> {
    const res = await this.ctx.put(path, { data });
    expect(res.status(), `PUT ${path} : ${await res.text()}`).toBeLessThan(400);
    return res.json();
  }

  /** Accepte les conditions en vigueur (sinon chaque page y renvoie). */
  async acceptTerms(): Promise<void> {
    const v = await this.get("/api/legal/versions");
    await this.post("/api/account/terms", {
      termsVersion: v.termsVersion,
      privacyVersion: v.privacyVersion,
    });
  }

  dispose(): Promise<void> {
    return this.ctx.dispose();
  }
}

function pick(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return Object.entries(value).find(([k]) => k === key)?.[1];
}
export function str(value: unknown, key: string): string {
  const v = pick(value, key);
  if (typeof v !== "string") throw new Error(`champ ${key} absent`);
  return v;
}
function num(value: unknown, key: string): number {
  const v = pick(value, key);
  if (typeof v !== "number") throw new Error(`champ ${key} absent`);
  return v;
}
function isJson(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
export function items(value: unknown, key: string): Json[] {
  const v = pick(value, key);
  return Array.isArray(v) ? v.filter(isJson) : [];
}

export async function organizationByName(api: Api, name: string) {
  const orgs = items(
    await api.get("/api/admin/organizations"),
    "organizations",
  );
  const org = orgs.find((o) => o.name === name);
  if (!org) throw new Error(`organisation ${name} absente`);
  return str(org, "id");
}

export async function roleByName(api: Api, orgId: string, name: string) {
  const roles = items(
    await api.get(`/api/admin/organizations/${orgId}/roles`),
    "roles",
  );
  const role = roles.find((r) => r.name === name);
  if (!role) throw new Error(`rôle ${name} absent`);
  return str(role, "id");
}

export async function userIdByEmail(api: Api, orgId: string, email: string) {
  const members = items(
    await api.get(`/api/admin/organizations/${orgId}/members`),
    "members",
  );
  const m = members.find((x) =>
    items(x, "identities").some((i) => i.identifier === email),
  );
  if (!m) throw new Error(`membre ${email} absent`);
  return str(m, "userId");
}

/** Compte e-mail + mot de passe créé dans une organisation, conditions acceptées. */
export async function createEmailMember(
  admin: Api,
  orgId: string,
  roleName: string,
  displayName: string,
): Promise<{ userId: string; email: string; password: string }> {
  const email = `${unique("e2e")}@wema.test`;
  const password = "mot-de-passe-e2e";
  const roleId = await roleByName(admin, orgId, roleName);
  const created = await admin.post(
    `/api/admin/organizations/${orgId}/members`,
    { displayName, roleId, login: { kind: "email", email, password } },
  );
  const user = await Api.login(email, password);
  await user.acceptTerms();
  await user.dispose();
  return { userId: str(created, "userId"), email, password };
}

/** Classe du jeu de démonstration (apps/api/src/seed-demo.ts). */
export const DEMO_CLASS = "4e A · Maths";

export interface SchoolWorld {
  schoolId: string;
  classId: string;
  /** Programme de la classe : celui de la classe de démonstration. */
  programId: string;
  className: string;
  learner: { userId: string; email: string; password: string; name: string };
}

/**
 * Une classe neuve du Collège démo, avec la prof de démonstration et un élève
 * neuf : un scénario peut y donner des devoirs sans gêner les autres.
 */
export async function createSchoolWorld(admin: Api): Promise<SchoolWorld> {
  const schoolId = await organizationByName(admin, "Collège démo");
  // Même programme que la classe de démonstration (4e de maths, France).
  // Par son nom : l'école contient aussi les classes créées par les scénarios.
  const demo = items(
    await admin.get(`/api/admin/organizations/${schoolId}/classes`),
    "classes",
  ).find((c) => c.name === DEMO_CLASS);
  if (!demo) throw new Error(`classe ${DEMO_CLASS} absente`);
  const programId = str(demo, "programId");
  const className = unique("Classe e2e");
  const classId = str(
    await admin.post(`/api/admin/organizations/${schoolId}/classes`, {
      name: className,
      programId,
    }),
    "id",
  );
  const teacherId = await userIdByEmail(admin, schoolId, "prof@wema.test");
  await admin.post(`/api/admin/classes/${classId}/members`, {
    userId: teacherId,
    role: "teacher",
  });
  const name = unique("Élève");
  const learner = await createEmailMember(admin, schoolId, "Élève", name);
  await admin.post(`/api/admin/classes/${classId}/members`, {
    userId: learner.userId,
    role: "learner",
  });
  return {
    schoolId,
    classId,
    programId,
    className,
    learner: { ...learner, name },
  };
}

/** Notions d'un programme (le même objectif existe dans plusieurs classes et pays). */
async function notionsOfProgram(admin: Api, programId: string) {
  const countries = items(
    await admin.get("/api/admin/curriculum/countries"),
    "countries",
  );
  for (const country of countries) {
    const curriculum = await admin.get(
      `/api/admin/curriculum/countries/${str(country, "id")}/curriculum`,
    );
    if (!items(curriculum, "programs").some((p) => p.id === programId))
      continue;
    const units = new Set(
      items(curriculum, "units")
        .filter((u) => u.programId === programId)
        .map((u) => u.id),
    );
    return new Set(
      items(curriculum, "notions")
        .filter((n) => units.has(n.unitId))
        .map((n) => str(n, "id")),
    );
  }
  throw new Error(`programme ${programId} absent`);
}

/**
 * Exercice validé de la bibliothèque Wema dont l'objectif contient
 * `objective` (sur une notion du programme `programId` s'il est donné).
 */
export async function platformExercise(
  admin: Api,
  objective: string,
  programId?: string,
) {
  const platformId = await organizationByName(admin, "Wema");
  const list = items(
    await admin.get(`/api/admin/organizations/${platformId}/exercises`),
    "exercises",
  );
  const notions = programId ? await notionsOfProgram(admin, programId) : null;
  const x = list.find(
    (e) =>
      e.status === "validated" &&
      (!notions ||
        (typeof e.notionId === "string" && notions.has(e.notionId))) &&
      typeof e.objective === "string" &&
      e.objective.includes(objective),
  );
  if (!x) throw new Error(`exercice « ${objective} » absent`);
  return str(x, "id");
}

export async function giveAssignment(
  admin: Api,
  classId: string,
  intentId: string,
  title: string,
): Promise<void> {
  const res = await admin.post(`/api/admin/classes/${classId}/assignments`, {
    intentId,
    title,
    dueAt: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
  });
  expect(num(res, "created")).toBeGreaterThan(0);
}

export interface FamilyWorld {
  familyId: string;
  /** Classe de l'enfant, dans son école sans contrat. */
  classId: string;
  parent: { userId: string; email: string; password: string };
  child: { userId: string; email: string; password: string; name: string };
}

/**
 * Famille neuve : un parent qui suit un enfant, élève d'une école SANS
 * contrat (programme de maths de France), donc concerné par les abonnements.
 */
export async function createFamilyWorld(admin: Api): Promise<FamilyWorld> {
  // L'école et sa classe, avec l'enfant (compte e-mail).
  const schoolId = str(
    await admin.post("/api/admin/organizations", {
      name: unique("École sans contrat"),
      kind: "school",
    }),
    "id",
  );
  await admin.post(`/api/admin/organizations/${schoolId}/roles`, {
    name: "Élève",
    permissions: ["curriculum.read"],
  });
  const name = unique("Enfant");
  const child = await createEmailMember(admin, schoolId, "Élève", name);
  const { programId } = await mathsProgram(admin, "FR");
  const classId = str(
    await admin.post(`/api/admin/organizations/${schoolId}/classes`, {
      name: unique("Classe"),
      programId,
    }),
    "id",
  );
  await admin.post(`/api/admin/classes/${classId}/members`, {
    userId: child.userId,
    role: "learner",
  });

  // La famille : le parent, l'enfant rattaché (par l'équipe Wema), le lien.
  const familyId = str(
    await admin.post("/api/admin/organizations", {
      name: unique("Famille e2e"),
      kind: "family",
    }),
    "id",
  );
  const role = async (roleName: string, permissions: string[]) =>
    admin.post(`/api/admin/organizations/${familyId}/roles`, {
      name: roleName,
      permissions,
    });
  await role("Parent", [
    "curriculum.read",
    "members.manage",
    "learners.read",
    "learners.write",
    "learners.health.read",
    "learners.health.write",
  ]);
  await role("Enfant", ["curriculum.read"]);
  const parent = await createEmailMember(
    admin,
    familyId,
    "Parent",
    "Parent e2e",
  );
  await admin.post(`/api/admin/organizations/${familyId}/members`, {
    displayName: name,
    roleId: await roleByName(admin, familyId, "Enfant"),
    login: { kind: "email", email: child.email },
  });
  await admin.post(`/api/admin/organizations/${familyId}/guardianships`, {
    guardianId: parent.userId,
    learnerId: child.userId,
  });
  return { familyId, classId, parent, child: { ...child, name } };
}

/** Programme de maths d'un pays (identifiants du référentiel). */
export async function mathsProgram(admin: Api, countryCode: string) {
  const countries = items(
    await admin.get("/api/admin/curriculum/countries"),
    "countries",
  );
  const country = countries.find((c) => c.code === countryCode);
  if (!country) throw new Error(`pays ${countryCode} absent`);
  const countryId = str(country, "id");
  const curriculum = await admin.get(
    `/api/admin/curriculum/countries/${countryId}/curriculum`,
  );
  const subject = items(curriculum, "subjects").find((s) => s.code === "maths");
  const program = items(curriculum, "programs").find(
    (p) => subject && p.subjectId === subject.id,
  );
  if (!subject || !program) throw new Error("programme de maths absent");
  return {
    countryId,
    subjectId: str(subject, "id"),
    programId: str(program, "id"),
  };
}

/** Une offre active en France pour les maths, avec essai (créée si besoin). */
export async function ensureOffer(admin: Api): Promise<void> {
  const { countryId, subjectId } = await mathsProgram(admin, "FR");
  const offers = items(await admin.get("/api/admin/billing/offers"), "offers");
  if (
    offers.some(
      (o) => o.countryId === countryId && o.subjectId === subjectId && o.active,
    )
  )
    return;
  const res = await admin.ctx.post("/api/admin/billing/offers", {
    data: {
      countryId,
      subjectId,
      currency: "EUR",
      amountMinor: 990,
      intervalMonths: 1,
      // Essai gratuit proposé (parcours famille) ; le paiement reste possible.
      trialDays: 7,
      methods: ["card", "mobile_money"],
      active: true,
    },
  });
  // 409 : un autre scénario vient de la créer.
  expect([201, 200, 409]).toContain(res.status());
}
