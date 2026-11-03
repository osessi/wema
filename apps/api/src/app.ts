import { Hono } from "hono";
import type { Deps } from "./context";
import { checkOrigin, fail } from "./http";
import {
  accountRoutes,
  legalRoutes,
  privacyAdminRoutes,
} from "./routes/account";
import { agendaRoutes } from "./routes/agenda";
import { aiRoutes } from "./routes/ai";
import { authRoutes } from "./routes/auth";
import { billingRoutes, billingWebhookRoutes } from "./routes/billing";
import { classRoutes } from "./routes/classes";
import { collectiveRoutes } from "./routes/collective";
import { costRoutes } from "./routes/costs";
import { curriculumRoutes } from "./routes/curriculum";
import { curriculumTransferRoutes } from "./routes/curriculum-transfer";
import { exerciseRoutes, learnerRoutes } from "./routes/exercises";
import { followUpRoutes } from "./routes/followup";
import { learnerFormatRoutes } from "./routes/formats";
import { messageRoutes } from "./routes/messages";
import { notificationRoutes } from "./routes/notifications";
import { organizationRoutes } from "./routes/organizations";
import { photoRoutes } from "./routes/photos";
import { profileRoutes } from "./routes/profile";
import { pushRoutes } from "./routes/push";
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
    // Webhooks des fournisseurs de paiement : sans session, avant les groupes montés sur « / ».
    .route("/billing/webhooks", billingWebhookRoutes(deps))
    // Sans session (pages légales, inscription) : avant les routes montées sur « / ».
    .route("/legal", legalRoutes(deps))
    .route("/account", accountRoutes(deps))
    .route("/admin/privacy", privacyAdminRoutes(deps))
    .route("/admin/curriculum", curriculumRoutes(deps))
    .route("/admin/settings", settingsRoutes(deps))
    .route("/admin/ai", aiRoutes(deps))
    .route("/admin/costs", costRoutes(deps))
    .route("/admin/collective", collectiveRoutes(deps))
    .route("/admin/curriculum-io", curriculumTransferRoutes(deps))
    .route("/admin", organizationRoutes(deps))
    .route("/admin", exerciseRoutes(deps))
    .route("/learner", learnerRoutes(deps))
    .route("/learner", learnerFormatRoutes(deps))
    .route("/learner/tutor", tutorRoutes(deps))
    .route("/learner", photoRoutes(deps))
    .route("/messages", messageRoutes(deps))
    .route("/agenda", agendaRoutes(deps))
    .route("/notifications", notificationRoutes(deps))
    .route("/me/push-tokens", pushRoutes(deps))
    .route("/", billingRoutes(deps))
    .route("/", profileRoutes(deps))
    .route("/", followUpRoutes(deps))
    .route("/", classRoutes(deps));
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
