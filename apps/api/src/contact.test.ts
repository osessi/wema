import { ok } from "@wema/domain";
import { describe, expect, it } from "vitest";
import type { EmailMessage } from "./notify/channels";
import { CONTACT_PER_HOUR } from "./routes/contact";
import { ADMIN, browser, field, testServer, WEB } from "./test-helpers";

type Server = Awaited<ReturnType<typeof testServer>>;

const VALID = {
  name: "Camille Test",
  email: "camille@wema.test",
  profile: "parent",
  organization: "École de test",
  message: "Bonjour, je voudrais en savoir plus sur Wema.",
};

/** Envoi du formulaire depuis le site public : sans session, avec l'IP du frontal. */
async function postContact(
  server: Server,
  body: unknown,
  ip = "203.0.113.10",
  origin = WEB,
) {
  const res = await server.app.request("/api/contact", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
  const json: unknown = await res.json();
  return { status: res.status, json };
}

async function countRows(server: Server): Promise<number> {
  const { rows } = await server.db.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM contact_requests",
  );
  return rows[0]?.n ?? 0;
}

describe("formulaire de contact du site public", () => {
  it("refuse un corps invalide avec une erreur typée, sans rien enregistrer", async () => {
    const server = await testServer();
    const res = await postContact(server, {
      ...VALID,
      email: "pas-une-adresse",
      profile: "inconnu",
      message: "court",
    });
    expect(res.status).toBe(400);
    expect(field(res.json, "error", "code")).toBe("invalid_request");
    const details = field(res.json, "error", "details");
    expect(Array.isArray(details)).toBe(true);
    const fields = Array.isArray(details)
      ? details.map((d: unknown) => field(d, "field"))
      : [];
    expect(fields).toEqual(
      expect.arrayContaining(["email", "profile", "message"]),
    );
    expect(
      (await postContact(server, { ...VALID, name: "x".repeat(121) })).status,
    ).toBe(400);
    expect(
      (
        await postContact(server, {
          ...VALID,
          organization: "x".repeat(201),
        })
      ).status,
    ).toBe(400);
    expect(await countRows(server)).toBe(0);
  });

  it("champ piège rempli : répond 200 sans rien enregistrer ni envoyer", async () => {
    const sent: EmailMessage[] = [];
    const server = await testServer({}, undefined, undefined, undefined, {
      contactNotify: {
        to: "equipe@wema.test",
        sender: {
          provider: "test",
          send: async (m) => {
            sent.push(m);
            return ok({ provider: "test", ref: null });
          },
        },
      },
    });
    const res = await postContact(server, {
      ...VALID,
      website: "https://spam.wema.test",
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true });
    expect(await countRows(server)).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("enregistre la demande, garde une empreinte de l'IP et prévient l'équipe", async () => {
    const sent: EmailMessage[] = [];
    const server = await testServer({}, undefined, undefined, undefined, {
      contactNotify: {
        to: "equipe@wema.test",
        sender: {
          provider: "test",
          send: async (m) => {
            sent.push(m);
            return ok({ provider: "test", ref: null });
          },
        },
      },
    });
    const res = await postContact(server, VALID, "203.0.113.20");
    expect(res.status).toBe(201);
    expect(res.json).toEqual({ ok: true });

    const { rows } = await server.db.query<{
      name: string;
      email: string;
      profile: string;
      organization: string | null;
      ip_hash: string;
      handled_at: Date | null;
    }>(
      "SELECT name, email, profile, organization, ip_hash, handled_at FROM contact_requests",
    );
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row?.email).toBe("camille@wema.test");
    expect(row?.profile).toBe("parent");
    expect(row?.organization).toBe("École de test");
    expect(row?.handled_at).toBeNull();
    expect(row?.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.ip_hash).not.toContain("203.0.113.20");

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("equipe@wema.test");
    expect(sent[0]?.replyTo).toBe("camille@wema.test");
    expect(sent[0]?.text).toContain(VALID.message);
  });

  it("sans adresse de l'équipe ni envoyeur, enregistre simplement", async () => {
    const server = await testServer();
    const res = await postContact(server, {
      ...VALID,
      organization: undefined,
    });
    expect(res.status).toBe(201);
    expect(await countRows(server)).toBe(1);
  });

  it("applique le contrôle d'origine et la limite par IP", async () => {
    const server = await testServer();
    const foreign = await postContact(
      server,
      VALID,
      "203.0.113.30",
      "https://autre-site.wema.test",
    );
    expect(foreign.status).toBe(403);
    expect(field(foreign.json, "error", "code")).toBe("bad_origin");

    for (let i = 0; i < CONTACT_PER_HOUR; i++)
      expect((await postContact(server, VALID, "203.0.113.40")).status).toBe(
        201,
      );
    const limited = await postContact(server, VALID, "203.0.113.40");
    expect(limited.status).toBe(429);
    expect(field(limited.json, "error", "code")).toBe("too_many_requests");
    // Une autre adresse n'est pas touchée.
    expect((await postContact(server, VALID, "203.0.113.41")).status).toBe(201);
  });
});

describe("demandes de contact dans le back-office", () => {
  it("refuse l'accès sans session ou sans la permission contacts.manage", async () => {
    const server = await testServer();
    const anonymous = browser(server.app);
    expect((await anonymous.get("/admin/contact-requests")).status).toBe(401);

    const visitor = browser(server.app);
    expect(
      (
        await visitor.post("/auth/register", {
          displayName: "Visiteur Test",
          email: "visiteur@wema.test",
          password: "mot-de-passe-de-test",
        })
      ).status,
    ).toBe(201);
    const list = await visitor.get("/admin/contact-requests");
    expect(list.status).toBe(403);
    expect(field(list.json, "error", "code")).toBe("forbidden");
    expect(
      (
        await visitor.post(
          "/admin/contact-requests/00000000-0000-4000-8000-000000000001/handled",
        )
      ).status,
    ).toBe(403);
  });

  it("liste les demandes (les plus récentes d'abord, paginées) et marque une demande traitée", async () => {
    const server = await testServer();
    await postContact(server, { ...VALID, name: "Première" });
    await postContact(server, { ...VALID, name: "Deuxième" });
    await postContact(server, { ...VALID, name: "Troisième" });
    // Dates distinctes : l'ordre ne dépend pas de la vitesse des insertions.
    await server.db.query(
      `UPDATE contact_requests SET created_at = now() - CASE name
         WHEN 'Première' THEN interval '3 hours'
         WHEN 'Deuxième' THEN interval '2 hours'
         ELSE interval '1 hour' END`,
    );

    const admin = browser(server.app);
    expect((await admin.post("/auth/login", ADMIN)).status).toBe(200);
    const page1 = await admin.get("/admin/contact-requests?pageSize=2");
    expect(page1.status).toBe(200);
    expect(field(page1.json, "total")).toBe(3);
    const requests = field(page1.json, "requests");
    const names = Array.isArray(requests)
      ? requests.map((r: unknown) => field(r, "name"))
      : [];
    expect(names).toEqual(["Troisième", "Deuxième"]);
    const page2 = await admin.get("/admin/contact-requests?pageSize=2&page=2");
    const rest = field(page2.json, "requests");
    expect(Array.isArray(rest) ? rest.length : -1).toBe(1);

    const first = Array.isArray(requests) ? requests[0] : undefined;
    const id = field(first, "id");
    expect(typeof id).toBe("string");
    expect(field(first, "handledAt")).toBeNull();
    const handled = await admin.post(`/admin/contact-requests/${id}/handled`);
    expect(handled.status).toBe(200);
    const handledAt = field(handled.json, "request", "handledAt");
    expect(typeof handledAt).toBe("string");
    // Deuxième clic : la première date est gardée.
    const again = await admin.post(`/admin/contact-requests/${id}/handled`);
    expect(field(again.json, "request", "handledAt")).toBe(handledAt);

    expect(
      (
        await admin.post(
          "/admin/contact-requests/00000000-0000-4000-8000-000000000001/handled",
        )
      ).status,
    ).toBe(404);
  });
});
