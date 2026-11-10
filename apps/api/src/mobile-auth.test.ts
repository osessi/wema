import { describe, expect, it } from "vitest";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

type App = Awaited<ReturnType<typeof testServer>>["app"];

/** Appli mobile : pas de cookie, jeton en `Authorization: Bearer`, pas d'Origin. */
function mobile(app: App, origin?: string) {
  let token = "";
  const call = async (method: string, path: string, body?: unknown) => {
    const headers: Record<string, string> = { "x-wema-client": "mobile" };
    if (origin) headers.origin = origin;
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await app.request(`/api${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const raw = await res.text();
    const json: unknown = raw ? JSON.parse(raw) : null;
    return { status: res.status, json, headers: res.headers };
  };
  return {
    setToken: (t: string) => {
      token = t;
    },
    get: (path: string) => call("GET", path),
    post: (path: string, body?: unknown) => call("POST", path, body ?? {}),
    delete: (path: string, body: unknown) => call("DELETE", path, body),
  };
}

const PUSH = "ExponentPushToken[abcDEF123_-]";

describe("session par jeton (appli mobile)", () => {
  it("la connexion renvoie un jeton, sans cookie, qui ouvre la session", async () => {
    const { app } = await testServer();
    const m = mobile(app);
    const login = await m.post("/auth/login", ADMIN);
    expect(login.status).toBe(200);
    expect(login.headers.get("set-cookie")).toBeNull();
    const token = text(login.json, "token");
    expect(token.length).toBeGreaterThan(20);

    expect((await m.get("/auth/me")).status).toBe(401);
    m.setToken(token);
    expect(text((await m.get("/auth/me")).json, "user", "displayName")).toBe(
      "Admin Test",
    );
    expect((await m.post("/auth/logout")).status).toBe(200);
    expect((await m.get("/auth/me")).status).toBe(401);
  });

  it("le navigateur garde son cookie et ne voit jamais le jeton", async () => {
    const { app } = await testServer();
    const b = browser(app);
    const login = await b.post("/auth/login", ADMIN);
    expect(login.status).toBe(200);
    expect(field(login.json, "token")).toBeUndefined();
    expect(b.cookie()).toMatch(/^wema_session=/);
  });

  it("un jeton faux ou mal formé est refusé", async () => {
    const { app } = await testServer();
    for (const authorization of ["Bearer faux", "Basic abc", "Bearer"]) {
      const res = await app.request("/api/auth/me", {
        headers: { authorization },
      });
      expect(res.status).toBe(401);
    }
  });

  it("une requête à jeton n'utilise jamais le cookie du navigateur", async () => {
    const { app } = await testServer();
    const b = browser(app);
    await b.post("/auth/login", ADMIN);
    const withCookie = (headers: Record<string, string>) =>
      app.request("/api/auth/me", {
        headers: { cookie: b.cookie(), ...headers },
      });
    expect((await withCookie({})).status).toBe(200);
    expect((await withCookie({ authorization: "Bearer faux" })).status).toBe(
      401,
    );
    expect((await withCookie({ "x-wema-client": "mobile" })).status).toBe(401);
  });

  it("le contrôle d'origine ne bloque pas l'appli, mais bloque toujours un site tiers", async () => {
    const { app } = await testServer();
    // Version web de l'appli : une origine inconnue, mais l'en-tête de l'appli.
    const m = mobile(app, "http://localhost:8081");
    const login = await m.post("/auth/login", ADMIN);
    expect(login.status).toBe(200);
    m.setToken(text(login.json, "token"));
    expect(
      (await m.post("/me/push-tokens", { token: PUSH, platform: "ios" }))
        .status,
    ).toBe(201);

    // Un site tiers avec le cookie du navigateur reste refusé.
    const b = browser(app);
    await b.post("/auth/login", ADMIN);
    const forged = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { origin: "https://pirate.example", cookie: b.cookie() },
    });
    expect(forged.status).toBe(403);
    expect((await b.get("/auth/me")).status).toBe(200);
  });
});

describe("jetons push", () => {
  it("enregistre, rafraîchit et retire le jeton de l'appareil", async () => {
    const { app, db } = await testServer();
    const m = mobile(app);
    m.setToken(text((await m.post("/auth/login", ADMIN)).json, "token"));

    expect(
      (
        await m.post("/me/push-tokens", {
          token: "pas-un-jeton",
          platform: "ios",
        })
      ).status,
    ).toBe(400);
    expect(
      (await m.post("/me/push-tokens", { token: PUSH, platform: "android" }))
        .status,
    ).toBe(201);
    // Deuxième enregistrement du même appareil : une seule ligne.
    await m.post("/me/push-tokens", { token: PUSH, platform: "android" });
    const count = async () =>
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM push_tokens",
        )
      ).rows[0]?.n;
    expect(await count()).toBe(1);

    expect((await m.delete("/me/push-tokens", { token: PUSH })).status).toBe(
      200,
    );
    expect(await count()).toBe(0);
  });

  it("un appareil passe au dernier compte connecté", async () => {
    const { app, db } = await testServer();
    const admin = mobile(app);
    admin.setToken(
      text((await admin.post("/auth/login", ADMIN)).json, "token"),
    );
    await admin.post("/me/push-tokens", { token: PUSH, platform: "ios" });

    const other = mobile(app);
    const reg = await other.post("/auth/register", {
      displayName: "Autre",
      email: "autre@example.test",
      password: "assez-long-pour-passer",
    });
    expect(reg.status).toBe(201);
    other.setToken(text(reg.json, "token"));
    await other.post("/me/push-tokens", { token: PUSH, platform: "ios" });

    const owner = await db.query<{ display_name: string }>(
      "SELECT u.display_name FROM push_tokens p JOIN users u ON u.id = p.user_id",
    );
    expect(owner.rows.map((r) => r.display_name)).toEqual(["Autre"]);
    // L'ancien propriétaire ne peut plus le retirer.
    await admin.delete("/me/push-tokens", { token: PUSH });
    expect((await db.query("SELECT 1 FROM push_tokens")).rows).toHaveLength(1);
  });

  it("exige une session", async () => {
    const { app } = await testServer();
    expect(
      (
        await mobile(app).post("/me/push-tokens", {
          token: PUSH,
          platform: "ios",
        })
      ).status,
    ).toBe(401);
  });
});
