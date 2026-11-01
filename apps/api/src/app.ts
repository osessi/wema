import { Hono } from "hono";
import type { Deps } from "./context";
import { checkOrigin, fail } from "./http";
import { aiRoutes } from "./routes/ai";
import { authRoutes } from "./routes/auth";
import { curriculumRoutes } from "./routes/curriculum";
import { exerciseRoutes, learnerRoutes } from "./routes/exercises";
import { followUpRoutes } from "./routes/followup";
import { organizationRoutes } from "./routes/organizations";
import { profileRoutes } from "./routes/profile";
import { settingsRoutes } from "./routes/settings";
import { tutorRoutes } from "./routes/tutor";

/** Assemble le serveur. Les routes sont servies sous /api (le web y redirige). */
export function createApp(deps: Deps) {
  const app = new Hono()
    .basePath("/api")
    .use(async (c, next) => {
      // Apple revient en POST depuis son propre domaine.
      if (c.req.path === "/api/auth/oauth/apple/callback") return next();
      return checkOrigin(deps)(c, next);
    })
    .get("/health", (c) => c.json({ ok: true }))
    .route("/auth", authRoutes(deps))
    .route("/admin/curriculum", curriculumRoutes(deps))
    .route("/admin/settings", settingsRoutes(deps))
    .route("/admin/ai", aiRoutes(deps))
    .route("/admin", organizationRoutes(deps))
    .route("/admin", exerciseRoutes(deps))
    .route("/learner", learnerRoutes(deps))
    .route("/learner/tutor", tutorRoutes(deps))
    .route("/", profileRoutes(deps))
    .route("/", followUpRoutes(deps));
  app.notFound((c) => fail(c, 404, "not_found"));
  app.onError((e, c) => {
    // Seulement le type et le message : le détail d'une erreur Postgres peut
    // contenir des valeurs (e-mail, téléphone…) qui n'ont rien à faire dans les logs.
    console.error(`${e.name} : ${e.message}`);
    return fail(c, 500, "internal_error");
  });
  return app;
}

export type AppType = ReturnType<typeof createApp>;
