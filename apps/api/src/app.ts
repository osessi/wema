import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Deps } from "./context";
import { checkOrigin, fail, isDatabaseUnavailable } from "./http";
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
import { contactAdminRoutes, contactRoutes } from "./routes/contact";
import { costRoutes } from "./routes/costs";
import { curriculumRoutes } from "./routes/curriculum";
import { curriculumGenerateRoutes } from "./routes/curriculum-generate";
import { curriculumTransferRoutes } from "./routes/curriculum-transfer";
import { diagnosticRoutes } from "./routes/diagnostic";
import { exerciseRoutes, learnerRoutes } from "./routes/exercises";
import { familyRoutes } from "./routes/family";
import { followUpRoutes } from "./routes/followup";
import { learnerFormatRoutes } from "./routes/formats";
import { messageRoutes } from "./routes/messages";
import { notificationRoutes } from "./routes/notifications";
import { onboardingRoutes } from "./routes/onboarding";
import { organizationRoutes } from "./routes/organizations";
import { photoRoutes } from "./routes/photos";
import { placementRoutes } from "./routes/placement";
import { profileRoutes } from "./routes/profile";
import { pushRoutes } from "./routes/push";
import { reportRoutes } from "./routes/reports";
import { reviewRoutes } from "./routes/review";
import { rosterRoutes } from "./routes/roster";
import { sessionBillingRoutes } from "./routes/session-billing";
import { settingsRoutes } from "./routes/settings";
import { teacherNoteRoutes } from "./routes/teacher-notes";
import { tutorRoutes } from "./routes/tutor";
import { tutorPersonaRoutes } from "./routes/tutor-persona";
import { tutoringRoutes } from "./routes/tutoring";

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
    // Sans session (pages légales, inscription, formulaire de contact) : avant les routes montées sur « / ».
    .route("/legal", legalRoutes(deps))
    .route("/account", accountRoutes(deps))
    .route("/contact", contactRoutes(deps))
    .route("/admin/privacy", privacyAdminRoutes(deps))
    .route("/admin/curriculum", curriculumRoutes(deps))
    .route("/admin/settings", settingsRoutes(deps))
    .route("/admin/ai", aiRoutes(deps))
    .route("/admin/costs", costRoutes(deps))
    .route("/admin/collective", collectiveRoutes(deps))
    .route("/admin/review", reviewRoutes(deps))
    .route("/admin/contact-requests", contactAdminRoutes(deps))
    .route("/admin/curriculum-io", curriculumTransferRoutes(deps))
    .route("/admin/curriculum-generate", curriculumGenerateRoutes(deps))
    .route("/admin", organizationRoutes(deps))
    .route("/admin", rosterRoutes(deps))
    .route("/admin", exerciseRoutes(deps))
    .route("/learner", learnerRoutes(deps))
    .route("/learner", learnerFormatRoutes(deps))
    .route("/learner/tutor", tutorRoutes(deps))
    .route("/learner/tutor-persona", tutorPersonaRoutes(deps))
    .route("/learner", photoRoutes(deps))
    .route("/learner/placement", placementRoutes(deps))
    .route("/family", familyRoutes(deps))
    .route("/tutoring", tutoringRoutes(deps))
    .route("/messages", messageRoutes(deps))
    .route("/agenda", agendaRoutes(deps))
    .route("/diagnostic", diagnosticRoutes(deps))
    .route("/onboarding", onboardingRoutes(deps))
    .route("/notifications", notificationRoutes(deps))
    .route("/me/push-tokens", pushRoutes(deps))
    .route("/reports", reportRoutes(deps))
    .route("/", billingRoutes(deps))
    .route("/", sessionBillingRoutes(deps))
    .route("/", profileRoutes(deps))
    .route("/", teacherNoteRoutes(deps))
    .route("/", followUpRoutes(deps))
    .route("/", classRoutes(deps));
  app.notFound((c) => fail(c, 404, "not_found"));
  app.onError((e, c) => {
    // Corps JSON illisible (levé par le validateur) : erreur du client.
    if (e instanceof HTTPException && e.status < 500)
      return fail(
        c,
        e.status,
        e.status === 400 ? "invalid_json" : "invalid_request",
      );
    // Seulement le type et le message : le détail d'une erreur Postgres peut
    // contenir des valeurs (e-mail, téléphone…) qui n'ont rien à faire dans les logs.
    console.error(`${e.name} : ${e.message}`);
    // Texte que Postgres refuse (caractère nul, encodage invalide) : erreur du client.
    if ("code" in e && (e.code === "22021" || e.code === "22P05"))
      return fail(c, 422, "invalid_text");
    // Postgres redémarre ou est coupé quelques secondes : « réessayez », pas un bug.
    if (isDatabaseUnavailable(e)) {
      c.header("Retry-After", "5");
      return fail(c, 503, "service_unavailable");
    }
    return fail(c, 500, "internal_error");
  });
  return app;
}

export type AppType = ReturnType<typeof createApp>;
