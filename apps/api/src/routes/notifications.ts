import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { fail, requireSession } from "../http";
import { isValidTimeZone, verifyUnsubscribeToken } from "../notify/rules";
import { createNotificationStore } from "../notify/store";

const channel = z.enum(["app", "email", "sms", "whatsapp", "off"]);
const hour = z.number().int().min(0).max(23);

/**
 * Préférences de notification de chacun (les siennes seulement), compteur de
 * messages non lus, et désinscription en un clic par lien signé (sans session).
 */
export function notificationRoutes(deps: Deps) {
  const store = createNotificationStore(deps.db);
  const session = requireSession(deps);
  const configured = new Set(
    deps.notifyChannels ?? ["email", "sms", "whatsapp"],
  );

  /** Canaux possibles pour la personne : une adresse et un prestataire. */
  const available = async (userId: string) => {
    const a = await store.addresses(userId);
    return {
      email: a.email !== null && configured.has("email"),
      sms: a.phone !== null && configured.has("sms"),
      whatsapp: a.phone !== null && configured.has("whatsapp"),
    };
  };

  const unsubscribe = async (token: string) => {
    const t = verifyUnsubscribeToken(deps.codeSecret, token);
    if (!t) return null;
    // Rien n'est plus envoyé hors de l'application pour cette sorte.
    try {
      await store.savePreferences(
        t.userId,
        t.kind === "nudge"
          ? { nudgeChannel: "app" }
          : { messageChannel: "app" },
        deps.now(),
      );
    } catch {
      return null; // compte supprimé depuis
    }
    return t.kind;
  };
  const tokenParam = zValidator(
    "param",
    z.object({ token: z.string().max(80) }),
  );

  return (
    new Hono<Env>()
      .get("/", session, async (c) => {
        const userId = c.get("user").id;
        const deliveries = await store.recent(userId);
        return c.json(
          {
            preferences: await store.preferences(userId),
            available: await available(userId),
            audience: (await store.isLearner(userId)) ? "learner" : "adult",
            guardian: await store.isGuardian(userId),
            deliveries: deliveries.map((d) => ({
              id: d.id,
              kind: d.kind,
              channel: d.channel,
              status: d.status,
              subject: d.subject,
              body: d.body,
              createdAt: d.createdAt.toISOString(),
              sentAt: d.sentAt?.toISOString() ?? null,
              notBefore: d.notBefore.toISOString(),
            })),
          },
          200,
        );
      })
      .put(
        "/",
        session,
        zValidator(
          "json",
          z
            .object({
              timeZone: z.string().max(64).nullable(),
              quietStart: hour,
              quietEnd: hour,
              nudgeChannel: channel,
              messageChannel: channel,
            })
            .partial(),
        ),
        async (c) => {
          const userId = c.get("user").id;
          const body = c.req.valid("json");
          if (
            body.timeZone !== undefined &&
            body.timeZone !== null &&
            !isValidTimeZone(body.timeZone)
          )
            return fail(c, 422, "invalid_preference", { field: "timeZone" });
          const can = await available(userId);
          for (const field of ["nudgeChannel", "messageChannel"] as const) {
            const v = body[field];
            if (v === "email" || v === "sms" || v === "whatsapp") {
              if (!can[v]) return fail(c, 422, "invalid_preference", { field });
            }
          }
          return c.json(
            {
              preferences: await store.savePreferences(
                userId,
                body,
                deps.now(),
              ),
            },
            200,
          );
        },
      )
      .get("/unread", session, async (c) => {
        return c.json(
          { messages: await store.unreadMessages(c.get("user").id) },
          200,
        );
      })
      // Lien cliqué : désinscrit puis montre la page de confirmation du web.
      .get("/unsubscribe/:token", tokenParam, async (c) => {
        const kind = await unsubscribe(c.req.valid("param").token);
        const page = new URL(
          "/compte/notifications/desinscription",
          deps.publicUrl,
        );
        if (kind) page.searchParams.set("sorte", kind);
        else page.searchParams.set("erreur", "1");
        return c.redirect(page.toString(), 303);
      })
      // Désinscription en un clic des messageries (RFC 8058, List-Unsubscribe-Post).
      .post("/unsubscribe/:token", tokenParam, async (c) => {
        const kind = await unsubscribe(c.req.valid("param").token);
        return kind
          ? c.json({ ok: true, kind }, 200)
          : fail(c, 404, "not_found");
      })
  );
}
