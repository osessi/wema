import {
  createAuditLog,
  createOrganizationStore,
  createSettingsStore,
} from "@wema/db";
import {
  DEFAULT_SETTINGS,
  parseLearnerModelSettings,
} from "@wema/learner-model";
import { Hono } from "hono";
import type { Deps, Env } from "../context";
import { fail, requirePermission, requireSession } from "../http";

export const LEARNER_MODEL_SETTINGS_KEY = "learner_model";

export function settingsRoutes(deps: Deps) {
  const settings = createSettingsStore(deps.db);
  const audit = createAuditLog(deps.db);

  return new Hono<Env>()
    .use(requireSession(deps), requirePermission("settings.pedagogy.manage"))
    .get("/pedagogy", async (c) => {
      const stored = await settings.get(LEARNER_MODEL_SETTINGS_KEY);
      const parsed = stored === null ? null : parseLearnerModelSettings(stored);
      return c.json(
        {
          settings: parsed?.ok ? parsed.value : DEFAULT_SETTINGS,
          defaults: DEFAULT_SETTINGS,
        },
        200,
      );
    })
    .put("/pedagogy", async (c) => {
      const parsed = parseLearnerModelSettings(await c.req.json());
      if (!parsed.ok)
        return fail(c, 422, "invalid_settings", parsed.error.issues);
      const actor = c.get("user").id;
      await settings.set(LEARNER_MODEL_SETTINGS_KEY, parsed.value, actor);
      const platform = await createOrganizationStore(
        deps.db,
      ).getPlatformOrganization();
      await audit.append({
        actorId: actor,
        organizationId: platform?.id ?? null,
        action: "settings.update",
        targetType: "settings",
        targetId: LEARNER_MODEL_SETTINGS_KEY,
        details: { ...parsed.value },
      });
      return c.json({ ok: true, settings: parsed.value });
    });
}
