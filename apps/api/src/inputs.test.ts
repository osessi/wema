import { describe, expect, it } from "vitest";
import { ADMIN, browser, field, testServer, WEB } from "./test-helpers";

// Entrées extrêmes relevées par les tests de charge (docs/tests-charge-2026-11.md).
describe("entrées mal formées", () => {
  it("un JSON malformé est une erreur du client (400 invalid_json), pas une erreur interne", async () => {
    const { app } = await testServer();
    const original = console.error;
    console.error = () => {};
    try {
      for (const path of ["/api/auth/login", "/api/auth/register"]) {
        const res = await app.request(path, {
          method: "POST",
          headers: { origin: WEB, "content-type": "application/json" },
          body: '{"email": "a@b.test", "password": ',
        });
        expect(res.status).toBe(400);
        expect(field(await res.json(), "error", "code")).toBe("invalid_json");
      }
    } finally {
      console.error = original;
    }
  });

  it("un caractère nul (refusé par Postgres) donne 422 invalid_text, pas 500", async () => {
    const server = await testServer();
    const b = browser(server.app);
    const original = console.error;
    console.error = () => {};
    try {
      const res = await b.post("/auth/register", {
        displayName: "Nom\u0000caché",
        email: "nul@example.test",
        password: "mot-de-passe-long",
      });
      expect(res.status).toBe(422);
      expect(field(res.json, "error", "code")).toBe("invalid_text");
    } finally {
      console.error = original;
    }
    // Le serveur continue de répondre normalement.
    expect((await b.post("/auth/login", ADMIN)).status).toBe(200);
  });
});
