import { ok } from "@wema/domain";
import { describe, expect, it } from "vitest";
import type { OAuthProvider } from "./oauth";
import { ADMIN, browser, field, testServer, text, WEB } from "./test-helpers";

describe("connexion", () => {
  it("refuse un mauvais mot de passe sans dire si le compte existe", async () => {
    const { app } = await testServer();
    const b = browser(app);
    const wrong = await b.post("/auth/login", {
      email: ADMIN.email,
      password: "pas-le-bon-mot",
    });
    const unknown = await b.post("/auth/login", {
      email: "personne@example.test",
      password: "pas-le-bon-mot",
    });
    expect(wrong.status).toBe(401);
    expect(unknown.json).toEqual(wrong.json);
  });

  it("inscription, session, puis déconnexion", async () => {
    const { app } = await testServer();
    const b = browser(app);
    expect(
      (
        await b.post("/auth/register", {
          displayName: "Parent Test",
          email: "parent@example.test",
          password: "court",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await b.post("/auth/register", {
          displayName: "Parent Test",
          email: "parent@example.test",
          password: "assez-long-pour-passer",
        })
      ).status,
    ).toBe(201);
    expect(text((await b.get("/auth/me")).json, "user", "displayName")).toBe(
      "Parent Test",
    );
    expect((await b.post("/auth/logout")).status).toBe(200);
    expect((await b.get("/auth/me")).status).toBe(401);
    expect(
      (
        await browser(app).post("/auth/register", {
          displayName: "X",
          email: "PARENT@example.test",
          password: "assez-long-pour-passer",
        })
      ).status,
    ).toBe(409);
  });

  it("connexion par code envoyé sur le téléphone, une seule fois", async () => {
    const { app, codeSender } = await testServer();
    const b = browser(app);
    expect(
      (
        await b.post("/auth/phone/request", {
          phone: "+229 01 00 00 00 00",
          channel: "whatsapp",
        })
      ).status,
    ).toBe(200);
    const sent = codeSender.sent[0];
    expect(sent).toMatchObject({ channel: "whatsapp", to: "+2290100000000" });
    const wrong = sent?.code === "000000" ? "111111" : "000000";
    expect(
      (
        await b.post("/auth/phone/verify", {
          phone: "+2290100000000",
          code: wrong,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await b.post("/auth/phone/verify", {
          phone: "+2290100000000",
          code: sent?.code,
          displayName: "Élève Tel",
        })
      ).status,
    ).toBe(200);
    expect(text((await b.get("/auth/me")).json, "user", "displayName")).toBe(
      "Élève Tel",
    );
    const reused = await browser(app).post("/auth/phone/verify", {
      phone: "+2290100000000",
      code: sent?.code,
    });
    expect(field(reused.json, "error", "code")).toBe("code_used");
  });

  it("limite le nombre de codes envoyés au même numéro", async () => {
    const { app } = await testServer();
    const b = browser(app);
    const statuses = [];
    for (let i = 0; i < 6; i++)
      statuses.push(
        (
          await b.post("/auth/phone/request", {
            phone: "+33600000001",
            channel: "sms",
          })
        ).status,
      );
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("Google : vérifie l'état puis ouvre une session, rattachée au compte qui a le même e-mail vérifié", async () => {
    const google: OAuthProvider = {
      start: () => ({
        url: new URL("https://accounts.example/auth?state=etat-1"),
        state: "etat-1",
        codeVerifier: "v",
      }),
      finish: async () =>
        ok({
          subject: "google-123",
          email: ADMIN.email,
          emailVerified: true,
          name: "Admin G",
        }),
    };
    const { app } = await testServer({ google });
    const start = await app.request("/api/auth/oauth/google/start");
    expect(start.headers.get("location")).toBe(
      "https://accounts.example/auth?state=etat-1",
    );
    const oauthCookie =
      start.headers.get("set-cookie")?.match(/wema_oauth=[^;]*/)?.[0] ?? "";

    const forged = await app.request(
      "/api/auth/oauth/google/callback?code=c&state=autre",
      { headers: { cookie: oauthCookie } },
    );
    expect(forged.headers.get("location")).toBe(
      `${WEB}/connexion?erreur=oauth`,
    );

    const back = await app.request(
      "/api/auth/oauth/google/callback?code=c&state=etat-1",
      { headers: { cookie: oauthCookie } },
    );
    expect(back.headers.get("location")).toBe(`${WEB}/admin`);
    const session =
      back.headers.get("set-cookie")?.match(/wema_session=[^;]*/)?.[0] ?? "";
    const me = await app.request("/api/auth/me", {
      headers: { cookie: session },
    });
    const body: unknown = await me.json();
    expect(field(body, "user", "displayName")).toBe("Admin Test");
    expect(field(body, "permissions")).toContain("curriculum.write");
  });
});
