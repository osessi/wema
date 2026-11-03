// Jeu de démonstration pour le développement : une école, une prof, une classe
// de 4e en maths avec trois élèves et un devoir, une famille avec un parent.
// Comptes fictifs (domaine .test) ; à lancer sur l'API qui tourne, après le seed.
// Usage : pnpm --filter @wema/api seed:demo

const API = `http://localhost:${process.env.PORT ?? 4000}/api`;
const ORIGIN = new URL(process.env.WEMA_PUBLIC_URL ?? "http://localhost:3000")
  .origin;
const PASSWORD = "demo-wema-2026";

let cookie = "";

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      origin: ORIGIN,
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const set = res.headers.get("set-cookie")?.match(/wema_session=([^;]*)/);
  if (set?.[1]) cookie = `wema_session=${set[1]}`;
  const json: unknown = res.headers.get("content-type")?.includes("json")
    ? await res.json()
    : null;
  if (!res.ok)
    throw new Error(
      `${method} ${path} : ${res.status} ${JSON.stringify(json)}`,
    );
  return json;
}

function pick(json: unknown, ...path: string[]): unknown {
  let value = json;
  for (const key of path) {
    if (typeof value !== "object" || value === null) return undefined;
    value = Object.entries(value).find(([k]) => k === key)?.[1];
  }
  return value;
}
const str = (json: unknown, ...path: string[]) => {
  const v = pick(json, ...path);
  if (typeof v !== "string") throw new Error(`${path.join(".")} absent`);
  return v;
};
const list = (json: unknown, ...path: string[]) => {
  const v = pick(json, ...path);
  return Array.isArray(v) ? v : [];
};

const email = process.env.WEMA_SUPER_ADMIN_EMAIL;
const password = process.env.WEMA_SUPER_ADMIN_PASSWORD;
if (!email || !password) {
  console.error("WEMA_SUPER_ADMIN_EMAIL et WEMA_SUPER_ADMIN_PASSWORD requis.");
  process.exit(1);
}
await call("POST", "/auth/login", { email, password });

const existing = list(
  await call("GET", "/admin/organizations"),
  "organizations",
);
// L'école de démo est sous contrat (facturation sur mesure) : ses élèves ont
// accès à toutes les matières sans abonnement (fiche 0009).
const underContract = (org: string) =>
  call("PUT", `/admin/billing/contracts/${org}`, { underContract: true });

const demoSchool = existing.find((o) => pick(o, "name") === "Collège démo");
if (demoSchool) {
  await underContract(str(demoSchool, "id"));
  console.info("Jeu de démonstration déjà présent (école sous contrat).");
  process.exit(0);
}

// Programme : 4e maths en France (jeu d'exemple).
const countries = list(
  await call("GET", "/admin/curriculum/countries"),
  "countries",
);
const france = countries.find((c) => pick(c, "code") === "FR");
if (!france) throw new Error("Lancez d'abord pnpm --filter @wema/api seed.");
const curriculum = await call(
  "GET",
  `/admin/curriculum/countries/${str(france, "id")}/curriculum`,
);
// La classe de démo est une 4e : on prend le programme de 4e s'il existe.
const grade4 = list(curriculum, "grades").find((g) => pick(g, "name") === "4e");
const programs = list(curriculum, "programs");
const program =
  programs.find((p) => grade4 && pick(p, "gradeId") === pick(grade4, "id")) ??
  programs[0];
const programId = program ? str(program, "id") : null;

const role = async (org: string, name: string, permissions: string[]) =>
  str(
    await call("POST", `/admin/organizations/${org}/roles`, {
      name,
      permissions,
    }),
    "id",
  );
const member = async (
  org: string,
  roleId: string,
  displayName: string,
  mail: string,
) =>
  str(
    await call("POST", `/admin/organizations/${org}/members`, {
      displayName,
      roleId,
      login: { kind: "email", email: mail, password: PASSWORD },
    }),
    "userId",
  );

const school = str(
  await call("POST", "/admin/organizations", {
    name: "Collège démo",
    kind: "school",
  }),
  "id",
);
await underContract(school);
const direction = await role(school, "Direction", [
  "curriculum.read",
  "members.manage",
  "roles.manage",
  "classes.manage",
  "exercises.read",
  "exercises.write",
  "learners.read",
  "learners.write",
  "learners.health.read",
  "audit.read",
]);
const teacherRole = await role(school, "Prof", [
  "curriculum.read",
  "exercises.read",
  "exercises.write",
  "learners.read",
  "learners.write",
]);
const learnerRole = await role(school, "Élève", ["curriculum.read"]);

await member(school, direction, "Awa Direction", "direction@wema.test");
const teacher = await member(
  school,
  teacherRole,
  "Mme Prof Démo",
  "prof@wema.test",
);
const learners = [
  await member(school, learnerRole, "Élève Un", "eleve1@wema.test"),
  await member(school, learnerRole, "Élève Deux", "eleve2@wema.test"),
  await member(school, learnerRole, "Élève Trois", "eleve3@wema.test"),
];

const classId = str(
  await call("POST", `/admin/organizations/${school}/classes`, {
    name: "4e A · Maths",
    programId,
  }),
  "id",
);
await call("POST", `/admin/classes/${classId}/members`, {
  userId: teacher,
  role: "teacher",
});
for (const userId of learners)
  await call("POST", `/admin/classes/${classId}/members`, {
    userId,
    role: "learner",
  });

// Devoir : un exercice validé de la bibliothèque Wema.
const me = await call("GET", "/auth/me");
const platform = list(me, "organizations").find(
  (o) => pick(o, "kind") === "platform",
);
if (platform) {
  const intents = list(
    await call("GET", `/admin/organizations/${str(platform, "id")}/exercises`),
    "exercises",
  ).filter((i) => pick(i, "status") === "validated");
  const intent = intents[0];
  if (intent) {
    await call("POST", `/admin/classes/${classId}/assignments`, {
      intentId: str(intent, "id"),
      title: "Premier devoir de la semaine",
      dueAt: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
    });
  } else
    console.warn(
      "Aucun exercice validé : pas de devoir (services/math lancé ?).",
    );
}

// Famille : un parent qui suit Élève Un.
const family = str(
  await call("POST", "/admin/organizations", {
    name: "Famille démo",
    kind: "family",
  }),
  "id",
);
const parentRole = await role(family, "Parent", [
  "curriculum.read",
  "members.manage",
  "learners.read",
  "learners.write",
  "learners.health.read",
  "learners.health.write",
]);
const childRole = await role(family, "Enfant", ["curriculum.read"]);
const parent = await member(
  family,
  parentRole,
  "Parent Démo",
  "parent@wema.test",
);
const child = await member(family, childRole, "Élève Un", "eleve1@wema.test");
await call("POST", `/admin/organizations/${family}/guardianships`, {
  guardianId: parent,
  learnerId: child,
});

console.info(`Jeu de démonstration créé. Mot de passe de tous les comptes : ${PASSWORD}
  direction@wema.test  (École)
  prof@wema.test       (Prof)
  eleve1@wema.test     (Élève, suivi par le parent)
  eleve2@wema.test, eleve3@wema.test
  parent@wema.test     (Parent)`);

export {};
