import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { requireSession } from "../http";
import { createPushTokenStore, EXPO_PUSH_TOKEN } from "../push-tokens";

const token = z.string().regex(EXPO_PUSH_TOKEN);

/** Enregistrement des appareils de l'appli mobile pour les notifications push. */
export function pushRoutes(deps: Deps) {
  const store = createPushTokenStore(deps.db);
  return new Hono<Env>()
    .use(requireSession(deps))
    .post(
      "/",
      zValidator(
        "json",
        z.object({ token, platform: z.enum(["ios", "android"]) }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        await store.register(
          c.get("user").id,
          body.token,
          body.platform,
          deps.now(),
        );
        return c.json({ ok: true }, 201);
      },
    )
    .delete("/", zValidator("json", z.object({ token })), async (c) => {
      await store.remove(c.get("user").id, c.req.valid("json").token);
      return c.json({ ok: true }, 200);
    });
}
