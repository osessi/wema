import { createHmac } from "node:crypto";
import { getConnInfo } from "@hono/node-server/conninfo";
import { zValidator } from "@hono/zod-validator";
import {
  CONTACT_PROFILES,
  type ContactRequest,
  createContactStore,
} from "@wema/db";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { fail, requirePermission, requireSession } from "../http";
import { createRateLimiter } from "../rate-limit";

/** Demandes envoyées par adresse IP et par heure, au plus. */
export const CONTACT_PER_HOUR = 5;

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(320),
  profile: z.enum(CONTACT_PROFILES),
  organization: z.string().trim().max(200).optional(),
  message: z.string().trim().min(10).max(4000),
  /** Champ piège : invisible pour une personne, rempli par les robots. */
  website: z.string().max(2000).optional(),
});

/**
 * Adresse IP du visiteur. Le frontal (Traefik de Coolify, ou Caddy) remplace
 * l'en-tête `X-Forwarded-For` reçu du visiteur par l'adresse qu'il voit : la
 * première valeur est donc celle du visiteur, même si un relais interne (Next)
 * en ajoute une après. Sans frontal (développement), l'adresse de la socket.
 */
export function clientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const real = c.req.header("x-real-ip")?.trim();
  if (real) return real;
  try {
    return getConnInfo(c).remote.address ?? "inconnue";
  } catch {
    // Requête sans socket Node (tests, autre environnement d'exécution).
    return "inconnue";
  }
}

/** Empreinte de l'adresse IP : HMAC avec le secret du serveur, jamais l'adresse en clair. */
export function hashIp(secret: string, ip: string): string {
  return createHmac("sha256", secret).update(`contact-ip:${ip}`).digest("hex");
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const PROFILE_LABELS: Record<ContactRequest["profile"], string> = {
  parent: "Parent",
  eleve: "Élève",
  prof: "Prof",
  ecole: "École",
  autre: "Autre",
};

/** E-mail envoyé à l'équipe pour une nouvelle demande. */
export function contactEmail(request: ContactRequest, adminUrl: string) {
  const lines: [string, string][] = [
    ["Nom", request.name],
    ["E-mail", request.email],
    ["Profil", PROFILE_LABELS[request.profile]],
    ...(request.organization
      ? [["Organisation", request.organization] satisfies [string, string]]
      : []),
  ];
  return {
    subject: `Nouvelle demande de contact : ${request.name}`,
    text: `${lines.map(([k, v]) => `${k} : ${v}`).join("\n")}\n\n${request.message}\n\nToutes les demandes : ${adminUrl}`,
    html: `<!doctype html><html lang="fr"><body style="font-family:sans-serif;line-height:1.5">
${lines.map(([k, v]) => `<p><strong>${k} :</strong> ${escapeHtml(v)}</p>`).join("\n")}
<p style="white-space:pre-wrap">${escapeHtml(request.message)}</p>
<p><a href="${escapeHtml(adminUrl)}">Toutes les demandes</a></p>
</body></html>`,
  };
}

const toJson = (r: ContactRequest) => ({
  id: r.id,
  createdAt: r.createdAt.toISOString(),
  name: r.name,
  email: r.email,
  profile: r.profile,
  organization: r.organization,
  message: r.message,
  handledAt: r.handledAt?.toISOString() ?? null,
});

/** Formulaire de contact du site public : sans session. */
export function contactRoutes(deps: Deps) {
  const store = createContactStore(deps.db);
  const limiter = createRateLimiter({
    max: CONTACT_PER_HOUR,
    windowMs: 60 * 60 * 1000,
    now: deps.now,
  });

  return new Hono<Env>().post(
    "/",
    zValidator("json", contactSchema, (result, c) => {
      if (!result.success)
        return fail(
          c,
          400,
          "invalid_request",
          result.error.issues.map((i) => ({
            field: i.path.join("."),
            code: i.code,
          })),
        );
    }),
    async (c) => {
      const body = c.req.valid("json");
      const ipHash = hashIp(deps.codeSecret, clientIp(c));
      if (!limiter.hit(ipHash)) return fail(c, 429, "too_many_requests");
      // Robot : on répond comme si tout allait bien, sans rien enregistrer.
      if (body.website !== undefined && body.website.trim() !== "")
        return c.json({ ok: true }, 200);
      const request = await store.create({
        name: body.name,
        email: body.email,
        profile: body.profile,
        organization: body.organization ? body.organization : null,
        message: body.message,
        ipHash,
      });
      const notify = deps.contactNotify;
      if (notify) {
        const sent = await notify.sender.send({
          to: notify.to,
          replyTo: request.email,
          ...contactEmail(request, `${deps.appUrl}/admin/contacts`),
        });
        // La demande est enregistrée : l'échec d'envoi n'est pas celui du visiteur.
        if (!sent.ok)
          console.error(`Contact : e-mail non envoyé (${sent.error.reason})`);
      }
      return c.json({ ok: true }, 201);
    },
  );
}

/** Demandes de contact dans le back-office : équipe Wema (contacts.manage). */
export function contactAdminRoutes(deps: Deps) {
  const store = createContactStore(deps.db);
  return new Hono<Env>()
    .use(requireSession(deps), requirePermission("contacts.manage"))
    .get(
      "/",
      zValidator(
        "query",
        z.object({
          page: z.coerce.number().int().min(1).max(10_000).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(25),
        }),
      ),
      async (c) => {
        const { page, pageSize } = c.req.valid("query");
        const { requests, total } = await store.list({
          limit: pageSize,
          offset: (page - 1) * pageSize,
        });
        return c.json(
          { requests: requests.map(toJson), page, pageSize, total },
          200,
        );
      },
    )
    .post(
      "/:id/handled",
      zValidator("param", z.object({ id: z.uuid() })),
      async (c) => {
        const request = await store.markHandled(
          c.req.valid("param").id,
          deps.now(),
        );
        if (!request) return fail(c, 404, "not_found");
        return c.json({ request: toJson(request) }, 200);
      },
    );
}
