import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import {
  createAccountStore,
  createAgendaStore,
  createBillingStore,
  createClassStore,
  createDiagnosticStore,
  createEventStore,
  type DiagnosticAppointment,
  type DiagnosticHypothesis,
  expandRule,
  fitsInside,
  freeSlots,
  type Interval,
} from "@wema/db";
import {
  asLearnerId,
  asUserId,
  containsHealthTerm,
  DIAGNOSTIC_MINUTES,
  type DiagnosticEligibility,
  type DiagnosticSheet,
  diagnosticEligibility,
  isPreferenceKey,
  parseLearningEvent,
  type UserId,
} from "@wema/domain";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { fail, requirePermission, requireSession } from "../http";
import { visioDomain, visioUrl } from "./agenda";

const uuid = z.uuid();
const instant = z.iso.datetime({ offset: true }).transform((s) => new Date(s));
/** Plus longue période de créneaux lue en une fois. */
const MAX_SLOT_RANGE_DAYS = 31;

const sheetText = z.string().trim().max(1000);
const sheetBody = z.object({
  since: sheetText,
  where: sheetText,
  blockers: sheetText,
  motivation: sheetText,
  learningStyle: sheetText,
  needs: sheetText,
});
const hypothesisBody = z.object({
  key: z.string().refine(isPreferenceKey, { message: "préférence inconnue" }),
  label: z.string().trim().min(1).max(40).nullable().default(null),
  value: z.boolean(),
  confidence: z.number().min(0).max(1),
});

/** Aucun texte de la fiche ne parle de santé : cela passe par le consentement du parent. */
export function mentionsHealth(input: {
  sheet: DiagnosticSheet;
  notes: string;
  hypotheses: readonly { label: string | null }[];
}): boolean {
  return (
    Object.values(input.sheet).some(containsHealthTerm) ||
    containsHealthTerm(input.notes) ||
    input.hypotheses.some(
      (h) => h.label !== null && containsHealthTerm(h.label),
    )
  );
}

/**
 * Rendez-vous de diagnostic de 15 minutes avec un conseiller Wema, inclus
 * après le paiement. Le parent réserve un créneau parmi les disponibilités
 * des conseillers (agenda existant) ; le conseiller remplit une fiche, puis
 * publie un compte rendu qui entre au journal (« diagnostic.reported ») et
 * alimente le profil. Aucun diagnostic médical, aucune donnée de santé.
 */
export function diagnosticRoutes(
  deps: Deps,
  options: { visioDomain?: string } = {},
) {
  const store = createDiagnosticStore(deps.db);
  const agenda = createAgendaStore(deps.db);
  const billing = createBillingStore(deps.db);
  const classes = createClassStore(deps.db);
  const accounts = createAccountStore(deps.db);
  const domain = options.visioDomain ?? visioDomain();

  const eligibilityOf = async (
    learnerId: string,
  ): Promise<DiagnosticEligibility> =>
    diagnosticEligibility({
      subscriptions: await billing.listSubscriptions({
        learnerIds: [asLearnerId(learnerId)],
      }),
      appointments: await store.listForLearners([learnerId]),
      now: deps.now(),
    });

  /** Plages de disponibilité de chaque conseiller sur la période. */
  const advisorWindows = async (from: Date, to: Date) => {
    const out: { advisorId: UserId; windows: Interval[] }[] = [];
    for (const advisorId of await store.advisors()) {
      const rules = await agenda.listRules(advisorId);
      const windows = rules.flatMap((r) => expandRule(r, from, to));
      if (windows.length > 0) out.push({ advisorId, windows });
    }
    return out;
  };

  /** Ce que la famille voit d'un rendez-vous (jamais la fiche ni les notes). */
  const familyView = (a: DiagnosticAppointment) => ({
    id: a.id,
    status: a.status,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    advisorName: a.advisorName,
    visioUrl: a.status === "booked" ? visioUrl(domain, a.room) : null,
  });

  const family = new Hono<Env>()
    // Enfants du parent : droit au rendez-vous et rendez-vous en cours.
    .get("/family", async (c) => {
      const children = await classes.childrenOf(c.get("user").id);
      const appointments = await store.listForLearners(
        children.map((k) => k.learnerId),
      );
      const out = [];
      for (const k of children) {
        const current = appointments.find(
          (a) =>
            a.learnerId === asUserId(k.learnerId) && a.status !== "cancelled",
        );
        out.push({
          learnerId: k.learnerId,
          displayName: k.displayName,
          eligibility: await eligibilityOf(k.learnerId),
          appointment: current ? familyView(current) : null,
        });
      }
      return c.json({ minutes: DIAGNOSTIC_MINUTES, children: out }, 200);
    })
    .get(
      "/slots",
      zValidator(
        "query",
        z.object({ learnerId: uuid, from: instant, to: instant }),
      ),
      async (c) => {
        const q = c.req.valid("query");
        const days = (q.to.getTime() - q.from.getTime()) / 86_400_000;
        if (!(days > 0 && days <= MAX_SLOT_RANGE_DAYS))
          return fail(c, 400, "invalid_range");
        if (!(await store.isGuardianOf(c.get("user").id, q.learnerId)))
          return fail(c, 403, "forbidden");
        const eligibility = await eligibilityOf(q.learnerId);
        if (!eligibility.eligible)
          return fail(c, 409, "not_eligible", { reason: eligibility.reason });
        const learnerBusy = await agenda.busy({
          teacherId: null,
          learnerIds: [asUserId(q.learnerId)],
          from: q.from,
          to: q.to,
        });
        const seen = new Set<number>();
        const slots: Interval[] = [];
        for (const { advisorId, windows } of await advisorWindows(
          q.from,
          q.to,
        )) {
          const busy = [
            ...(await store.advisorBusy(advisorId, q.from, q.to)),
            ...learnerBusy,
          ];
          for (const s of freeSlots(
            windows,
            busy,
            DIAGNOSTIC_MINUTES,
            deps.now(),
          ))
            if (
              s.start >= q.from &&
              s.end <= q.to &&
              !seen.has(s.start.getTime())
            ) {
              seen.add(s.start.getTime());
              slots.push(s);
            }
        }
        slots.sort((a, b) => a.start.getTime() - b.start.getTime());
        return c.json(
          { slots: slots.map((s) => ({ start: s.start, end: s.end })) },
          200,
        );
      },
    )
    .post(
      "/bookings",
      zValidator("json", z.object({ learnerId: uuid, startsAt: instant })),
      async (c) => {
        const userId = c.get("user").id;
        const body = c.req.valid("json");
        if (!(await store.isGuardianOf(userId, body.learnerId)))
          return fail(c, 403, "forbidden");
        if (body.startsAt.getTime() <= deps.now().getTime())
          return fail(c, 400, "in_past");
        const eligibility = await eligibilityOf(body.learnerId);
        if (!eligibility.eligible)
          return fail(c, 409, "not_eligible", { reason: eligibility.reason });
        const slot = {
          start: body.startsAt,
          end: new Date(body.startsAt.getTime() + DIAGNOSTIC_MINUTES * 60_000),
        };
        // Le premier conseiller disponible sur ce créneau le prend.
        for (const { advisorId, windows } of await advisorWindows(
          slot.start,
          slot.end,
        )) {
          if (!fitsInside(slot, windows)) continue;
          const booked = await store.book({
            advisorId,
            learnerId: asUserId(body.learnerId),
            bookedBy: userId,
            startsAt: slot.start,
            endsAt: slot.end,
          });
          if (booked.ok) return c.json({ ok: true, id: booked.id }, 201);
          if (booked.error !== "advisor_busy")
            return fail(c, 409, booked.error);
        }
        return fail(c, 409, "slot_unavailable");
      },
    )
    .post(
      "/:id/cancel",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const userId = c.get("user").id;
        const appointment = await store.get(c.req.valid("param").id);
        if (
          !appointment ||
          !(
            appointment.advisorId === userId ||
            (await store.isGuardianOf(userId, appointment.learnerId))
          )
        )
          return fail(c, 404, "not_found");
        return (await store.cancel(appointment.id, deps.now()))
          ? c.json({ ok: true }, 200)
          : fail(c, 409, "not_cancelable");
      },
    );

  // ---------- Espace du conseiller ----------
  const advisor = new Hono<Env>()
    .use(requirePermission("diagnostic.conduct"))
    .get("/", async (c) => {
      const userId = c.get("user").id;
      const [appointments, rules] = await Promise.all([
        store.listForAdvisor(userId),
        agenda.listRules(userId),
      ]);
      return c.json(
        {
          minutes: DIAGNOSTIC_MINUTES,
          rules,
          appointments: appointments
            .filter((a) => a.status !== "cancelled")
            .map((a) => ({
              id: a.id,
              learnerId: a.learnerId,
              learnerName: a.learnerName,
              startsAt: a.startsAt,
              endsAt: a.endsAt,
              status: a.status,
              reportedAt: a.reportedAt,
            })),
        },
        200,
      );
    })
    .get("/:id", zValidator("param", z.object({ id: uuid })), async (c) => {
      const a = await store.get(c.req.valid("param").id);
      if (!a || a.advisorId !== c.get("user").id)
        return fail(c, 404, "not_found");
      const bookedBy = a.bookedBy ? await accounts.getUser(a.bookedBy) : null;
      return c.json(
        {
          id: a.id,
          learnerId: a.learnerId,
          learnerName: a.learnerName,
          guardianName: bookedBy?.displayName ?? null,
          startsAt: a.startsAt,
          endsAt: a.endsAt,
          status: a.status,
          sheet: a.sheet,
          hypotheses: a.hypotheses,
          notes: a.notes,
          reportedAt: a.reportedAt,
          visioUrl: a.status === "booked" ? visioUrl(domain, a.room) : null,
        },
        200,
      );
    })
    .put(
      "/:id",
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "json",
        z.object({
          sheet: sheetBody,
          hypotheses: z.array(hypothesisBody).max(20),
          notes: z.string().trim().max(4000),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        if (mentionsHealth(body)) return fail(c, 422, "health_term");
        const hypotheses: DiagnosticHypothesis[] = [];
        for (const h of body.hypotheses)
          if (isPreferenceKey(h.key))
            hypotheses.push({
              ...h,
              key: h.key,
              label: h.key === "interest" ? h.label : null,
            });
        const saved = await store.saveSheet({
          id: c.req.valid("param").id,
          advisorId: c.get("user").id,
          sheet: body.sheet,
          hypotheses,
          notes: body.notes,
        });
        return saved ? c.json({ ok: true }, 200) : fail(c, 404, "not_found");
      },
    )
    // Publication : le compte rendu entre au journal et alimente le profil.
    .post(
      "/:id/report",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const userId = c.get("user").id;
        const a = await store.get(c.req.valid("param").id);
        if (!a || a.advisorId !== userId) return fail(c, 404, "not_found");
        if (a.status !== "booked") return fail(c, 409, "already_reported");
        const now = deps.now();
        if (a.startsAt.getTime() > now.getTime())
          return fail(c, 409, "not_started");
        if (
          Object.values(a.sheet).every((v) => v.trim() === "") &&
          a.hypotheses.length === 0
        )
          return fail(c, 422, "empty_report");
        if (mentionsHealth({ ...a, notes: "" }))
          return fail(c, 422, "health_term");
        const parsed = parseLearningEvent({
          id: randomUUID(),
          learnerId: a.learnerId,
          occurredAt: now,
          source: "advisor",
          payload: {
            type: "diagnostic.reported",
            appointmentId: a.id,
            sheet: a.sheet,
            hypotheses: a.hypotheses,
          },
        });
        if (!parsed.ok) return fail(c, 422, "invalid_report");
        const event = parsed.value;
        const done = await deps.db.transaction(async (tx) => {
          const marked = await createDiagnosticStore(tx).markReported(
            a.id,
            userId,
            event.id,
            now,
          );
          if (!marked) return false;
          const appended = await createEventStore(tx).append(event);
          if (!appended.ok)
            throw new Error("identifiant d'événement en conflit");
          return true;
        });
        return done
          ? c.json({ ok: true }, 200)
          : fail(c, 409, "already_reported");
      },
    );

  return new Hono<Env>()
    .use(requireSession(deps))
    .route("/advisor", advisor)
    .route("/", family);
}
