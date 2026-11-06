import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import {
  type AgendaStore,
  BLOCKING_STATUSES,
  createAgendaStore,
  createClassStore,
  createEventStore,
  expandRule,
  fitsInside,
  freeSlots,
  type Interval,
  isIsoDate,
  isValidTimeZone,
  parseClock,
  type SqlExecutor,
  type TutoringSession,
  type ViewerRole,
} from "@wema/db";
import {
  asEventId,
  asLearnerId,
  asNotionId,
  asUserId,
  type UserId,
} from "@wema/domain";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { fail, requireSession } from "../http";

const uuid = z.uuid();
const instant = z.iso.datetime({ offset: true }).transform((s) => new Date(s));

/** Plus longue période lue en une fois (vue année et ses marges). */
const MAX_RANGE_DAYS = 400;
/** Plus longue séance. */
const MAX_SESSION_MINUTES = 240;
const DEFAULT_VISIO_DOMAIN = "meet.jit.si";

/**
 * Domaine Jitsi Meet des salles de visio (WEMA_JITSI_DOMAIN), meet.jit.si par
 * défaut. Un nom d'hôte seul : pas de schéma, de chemin ni de port exotique.
 */
export function visioDomain(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.WEMA_JITSI_DOMAIN?.trim().toLowerCase();
  return value && /^[a-z0-9.-]+(:\d{2,5})?$/.test(value)
    ? value
    : DEFAULT_VISIO_DOMAIN;
}

/** Lien de la salle. Aucun enregistrement : les options sont fixées dans l'adresse. */
export function visioUrl(domain: string, room: string): string {
  return `https://${domain}/${room}`;
}

const rangeQuery = z.object({ from: instant, to: instant });

function badRange(from: Date, to: Date): boolean {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  return !(days > 0 && days <= MAX_RANGE_DAYS);
}

function badSessionTimes(start: Date, end: Date): boolean {
  const minutes = (end.getTime() - start.getTime()) / 60_000;
  return !(minutes >= 15 && minutes <= MAX_SESSION_MINUTES);
}

/** Séance telle qu'elle s'affiche dans un agenda. */
function sessionItem(s: TutoringSession & { learnerIds?: UserId[] }) {
  return {
    id: s.id,
    kind: s.kind,
    title: s.title,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    status: s.status,
    teacherId: s.teacherId,
    teacherName: s.teacherName,
    learnerName: s.learnerName,
    groupName: s.groupName,
    learnerIds: s.learnerIds ?? (s.learnerId ? [s.learnerId] : []),
  };
}

/** Élèves d'une séance (pour les conflits et les comptes rendus). */
async function learnersOf(store: AgendaStore, s: TutoringSession) {
  return (await store.participants(s)).learners.map((l) => l.userId);
}

/** Plages de disponibilité d'un prof sur la période, avec la durée de leurs créneaux. */
async function teacherWindows(
  store: AgendaStore,
  teacherId: UserId,
  from: Date,
  to: Date,
) {
  const rules = await store.listRules(teacherId);
  return rules.flatMap((r) =>
    expandRule(r, from, to).map((w) => ({ ...w, slotMinutes: r.slotMinutes })),
  );
}

/** La famille (parent, ou élève autonome) peut-elle agir sur cette séance ? */
async function familyCanAct(
  store: AgendaStore,
  s: TutoringSession,
  userId: UserId,
): Promise<boolean> {
  if (s.kind !== "individual" || !s.learnerId) return false;
  return (await store.bookable(userId)).some(
    (b) => b.teacherId === s.teacherId && b.learnerId === s.learnerId,
  );
}

/**
 * Agenda : disponibilités récurrentes des profs, réservation par la famille,
 * séances individuelles ou de groupe en visio (Jitsi Meet, salle au nom
 * aléatoire, aucun enregistrement), compte rendu qui alimente le profil par
 * un événement. Les droits suivent les liens réels de la messagerie.
 */
export function agendaRoutes(
  deps: Deps,
  options: { visioDomain?: string } = {},
) {
  const store = createAgendaStore(deps.db);
  const classes = createClassStore(deps.db);
  const domain = options.visioDomain ?? visioDomain();

  return (
    new Hono<Env>()
      .use(requireSession(deps))
      // ---------- Agenda (toutes les vues) ----------
      .get(
        "/calendar",
        zValidator(
          "query",
          rangeQuery.extend({
            space: z.enum(["teacher", "learner", "guardian"]),
          }),
        ),
        async (c) => {
          const { from, to, space } = c.req.valid("query");
          if (badRange(from, to)) return fail(c, 400, "invalid_range");
          const userId = c.get("user").id;
          if (space === "teacher") {
            const sessions = await store.listSessions(
              { teacherId: userId },
              from,
              to,
            );
            const windows = await teacherWindows(store, userId, from, to);
            return c.json(
              {
                sessions: sessions.map(sessionItem),
                availability: windows.map((w) => ({
                  start: w.start,
                  end: w.end,
                })),
                assignments: [],
              },
              200,
            );
          }
          const learnerIds =
            space === "learner" ? [userId] : await store.childrenOf(userId);
          const names = new Map<string, string>();
          if (space === "guardian")
            for (const child of await classes.childrenOf(userId))
              names.set(child.learnerId, child.displayName);
          const sessions =
            learnerIds.length === 0
              ? []
              : await store.listSessions({ learnerIds }, from, to);
          const assignments = [];
          for (const id of learnerIds)
            for (const a of await classes.assignmentsForLearner(
              asLearnerId(id),
            ))
              if (a.dueAt >= from && a.dueAt < to)
                assignments.push({
                  id: a.id,
                  title: a.title,
                  dueAt: a.dueAt,
                  done: a.done,
                  learnerName: names.get(id) ?? null,
                });
          return c.json(
            {
              sessions: sessions.map((s) => ({
                ...sessionItem(s),
                // Pour un parent : lesquels de ses enfants sont concernés.
                childNames: s.learnerIds
                  .map((id) => names.get(id))
                  .filter((n): n is string => n !== undefined),
              })),
              availability: [],
              assignments,
            },
            200,
          );
        },
      )
      // ---------- Espace prof ----------
      .get("/teacher", async (c) => {
        const userId = c.get("user").id;
        const [rules, groups, learners, notions, pending] = await Promise.all([
          store.listRules(userId),
          store.listGroups(userId),
          store.teacherLearners(userId),
          store.teacherNotions(userId),
          store.pendingForTeacher(userId),
        ]);
        return c.json(
          {
            rules,
            groups,
            learners,
            notions,
            pending: pending.map((s) => ({
              ...sessionItem(s),
              requestNote: s.requestNote,
            })),
          },
          200,
        );
      })
      .post(
        "/availability",
        zValidator(
          "json",
          z.object({
            weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
            startTime: z.string(),
            endTime: z.string(),
            timeZone: z.string().min(1).max(64),
            validFrom: z.string(),
            validUntil: z.string().nullable(),
            everyNWeeks: z.number().int().min(1).max(8).default(1),
            slotMinutes: z.number().int().min(15).max(240).default(60),
          }),
        ),
        async (c) => {
          const body = c.req.valid("json");
          const startMinute = parseClock(body.startTime);
          const endMinute = parseClock(body.endTime);
          if (
            startMinute === null ||
            endMinute === null ||
            endMinute <= startMinute ||
            endMinute - startMinute < body.slotMinutes
          )
            return fail(c, 400, "invalid_range");
          if (!isValidTimeZone(body.timeZone))
            return fail(c, 400, "invalid_time_zone");
          if (
            !isIsoDate(body.validFrom) ||
            (body.validUntil !== null &&
              (!isIsoDate(body.validUntil) || body.validUntil < body.validFrom))
          )
            return fail(c, 400, "invalid_range");
          const id = await store.addRule(c.get("user").id, {
            weekdays: body.weekdays,
            startMinute,
            endMinute,
            timeZone: body.timeZone,
            validFrom: body.validFrom,
            validUntil: body.validUntil,
            everyNWeeks: body.everyNWeeks,
            slotMinutes: body.slotMinutes,
          });
          return c.json({ id }, 201);
        },
      )
      .delete(
        "/availability/:id",
        zValidator("param", z.object({ id: uuid })),
        async (c) => {
          const ok = await store.deleteRule(
            c.req.valid("param").id,
            c.get("user").id,
          );
          return ok ? c.json({ ok: true }, 200) : fail(c, 404, "not_found");
        },
      )
      .post(
        "/groups",
        zValidator(
          "json",
          z.object({
            id: uuid.optional(),
            name: z.string().trim().min(1).max(120),
            notionId: uuid.nullable(),
            learnerIds: z.array(uuid).min(1).max(60),
          }),
        ),
        async (c) => {
          const userId = c.get("user").id;
          const body = c.req.valid("json");
          if (body.id) {
            const existing = await store.getGroup(body.id);
            if (!existing || existing.teacherId !== userId)
              return fail(c, 404, "not_found");
          }
          // Uniquement des élèves de ses propres classes, et une notion de leurs programmes.
          const mine = await store.teacherLearners(userId);
          const members = [];
          for (const id of new Set(body.learnerIds)) {
            const link = mine.find((l) => l.learnerId === id);
            if (!link) return fail(c, 403, "forbidden");
            members.push({ learnerId: link.learnerId, classId: link.classId });
          }
          if (
            body.notionId &&
            !(await store.teacherNotions(userId)).some(
              (n) => n.id === body.notionId,
            )
          )
            return fail(c, 400, "invalid_notion");
          const id = await store.saveGroup({
            ...(body.id ? { id: body.id } : {}),
            teacherId: userId,
            name: body.name,
            notionId: body.notionId,
            members,
          });
          return c.json({ id }, body.id ? 200 : 201);
        },
      )
      .delete(
        "/groups/:id",
        zValidator("param", z.object({ id: uuid })),
        async (c) => {
          const ok = await store.archiveGroup(
            c.req.valid("param").id,
            c.get("user").id,
          );
          return ok ? c.json({ ok: true }, 200) : fail(c, 404, "not_found");
        },
      )
      // Le prof planifie lui-même une séance (confirmée d'emblée).
      .post(
        "/sessions",
        zValidator(
          "json",
          z.object({
            target: z.discriminatedUnion("kind", [
              z.object({ kind: z.literal("individual"), learnerId: uuid }),
              z.object({ kind: z.literal("group"), groupId: uuid }),
            ]),
            title: z.string().trim().min(1).max(120).nullable(),
            startsAt: instant,
            endsAt: instant,
          }),
        ),
        async (c) => {
          const userId = c.get("user").id;
          const body = c.req.valid("json");
          if (badSessionTimes(body.startsAt, body.endsAt))
            return fail(c, 400, "invalid_range");
          if (body.startsAt.getTime() <= deps.now().getTime())
            return fail(c, 400, "in_past");
          let learnerIds: UserId[];
          let learnerId: UserId | null = null;
          let groupId: string | null = null;
          if (body.target.kind === "individual") {
            const target = body.target.learnerId;
            if (
              !(await store.teacherLearners(userId)).some(
                (l) => l.learnerId === target,
              )
            )
              return fail(c, 403, "forbidden");
            learnerId = asUserId(target);
            learnerIds = [learnerId];
          } else {
            const group = await store.getGroup(body.target.groupId);
            if (!group || group.teacherId !== userId)
              return fail(c, 404, "not_found");
            if (group.members.length === 0) return fail(c, 400, "empty_group");
            groupId = group.id;
            learnerIds = group.members.map((m) => m.learnerId);
          }
          const created = await store.createSession({
            teacherId: userId,
            kind: body.target.kind,
            learnerId,
            groupId,
            learnerIds,
            title: body.title,
            startsAt: body.startsAt,
            endsAt: body.endsAt,
            status: "confirmed",
            requestedBy: userId,
            requestNote: null,
          });
          if (!created.ok) return fail(c, 409, created.error);
          return c.json({ id: created.id }, 201);
        },
      )
      // ---------- Familles : réservation ----------
      // Ce qu'un parent ou un élève peut réserver, et ses séances à venir.
      .get(
        "/family",
        zValidator(
          "query",
          z.object({ space: z.enum(["learner", "guardian"]) }),
        ),
        async (c) => {
          const userId = c.get("user").id;
          const { space } = c.req.valid("query");
          const bookable = (await store.bookable(userId)).filter(
            (b) => (b.via === "self") === (space === "learner"),
          );
          const learnerIds =
            space === "learner" ? [userId] : await store.childrenOf(userId);
          const now = deps.now();
          const upcoming =
            learnerIds.length === 0
              ? []
              : await store.listSessions(
                  { learnerIds },
                  now,
                  new Date(now.getTime() + 90 * 86_400_000),
                );
          return c.json(
            {
              bookable,
              upcoming: upcoming
                .filter((s) => BLOCKING_STATUSES.includes(s.status))
                .map(sessionItem),
            },
            200,
          );
        },
      )
      .get(
        "/slots",
        zValidator(
          "query",
          rangeQuery.extend({ teacherId: uuid, learnerId: uuid }),
        ),
        async (c) => {
          const q = c.req.valid("query");
          if (badRange(q.from, q.to) || badLongRange(q.from, q.to))
            return fail(c, 400, "invalid_range");
          const userId = c.get("user").id;
          if (
            !(await store.bookable(userId)).some(
              (b) => b.teacherId === q.teacherId && b.learnerId === q.learnerId,
            )
          )
            return fail(c, 403, "forbidden");
          const teacherId = asUserId(q.teacherId);
          const windows = await teacherWindows(store, teacherId, q.from, q.to);
          // Occupé : le prof (sans rien dévoiler de ses séances) et l'enfant lui-même.
          const busy = await store.busy({
            teacherId,
            learnerIds: [asUserId(q.learnerId)],
            from: q.from,
            to: q.to,
          });
          const bySize = new Map<number, Interval[]>();
          for (const w of windows)
            bySize.set(w.slotMinutes, [
              ...(bySize.get(w.slotMinutes) ?? []),
              w,
            ]);
          const seen = new Set<number>();
          const slots: Interval[] = [];
          for (const [size, list] of bySize)
            for (const s of freeSlots(list, busy, size, deps.now()))
              if (!seen.has(s.start.getTime())) {
                seen.add(s.start.getTime());
                slots.push(s);
              }
          slots.sort((a, b) => a.start.getTime() - b.start.getTime());
          return c.json(
            {
              slots: slots
                .filter((s) => s.start >= q.from && s.end <= q.to)
                .map((s) => ({ start: s.start, end: s.end })),
            },
            200,
          );
        },
      )
      .post(
        "/bookings",
        zValidator(
          "json",
          z.object({
            teacherId: uuid,
            learnerId: uuid,
            startsAt: instant,
            endsAt: instant,
            note: z.string().trim().max(500).nullable().default(null),
          }),
        ),
        async (c) => {
          const userId = c.get("user").id;
          const body = c.req.valid("json");
          if (
            !(await store.bookable(userId)).some(
              (b) =>
                b.teacherId === body.teacherId &&
                b.learnerId === body.learnerId,
            )
          )
            return fail(c, 403, "forbidden");
          if (badSessionTimes(body.startsAt, body.endsAt))
            return fail(c, 400, "invalid_range");
          if (body.startsAt.getTime() <= deps.now().getTime())
            return fail(c, 400, "in_past");
          const teacherId = asUserId(body.teacherId);
          const slot = { start: body.startsAt, end: body.endsAt };
          // Le créneau doit tenir dans une disponibilité du prof.
          const windows = await teacherWindows(
            store,
            teacherId,
            new Date(slot.start.getTime() - 86_400_000),
            new Date(slot.end.getTime() + 86_400_000),
          );
          if (!fitsInside(slot, windows))
            return fail(c, 409, "slot_unavailable");
          const learnerId = asUserId(body.learnerId);
          const created = await store.createSession({
            teacherId,
            kind: "individual",
            learnerId,
            groupId: null,
            learnerIds: [learnerId],
            title: null,
            startsAt: body.startsAt,
            endsAt: body.endsAt,
            status: "requested",
            requestedBy: userId,
            requestNote: body.note || null,
          });
          if (!created.ok) return fail(c, 409, created.error);
          return c.json({ id: created.id }, 201);
        },
      )
      // ---------- Une séance ----------
      .get(
        "/sessions/:id",
        zValidator("param", z.object({ id: uuid })),
        async (c) => {
          const userId = c.get("user").id;
          const s = await store.getSession(c.req.valid("param").id);
          if (!s) return fail(c, 404, "not_found");
          const role = await store.viewerRole(s, userId);
          if (!role) return fail(c, 404, "not_found");
          const now = deps.now();
          const participants = await store.participants(s);
          const family =
            role !== "teacher" && (await familyCanAct(store, s, userId));
          const future = s.endsAt.getTime() > now.getTime();
          const blocking = BLOCKING_STATUSES.includes(s.status);
          const reportNames = await store.notionNames(
            s.report?.notionIds ?? [],
          );
          return c.json(
            {
              session: {
                ...sessionItem(s),
                requestNote: s.requestNote,
                groupNotionId: s.groupNotionId,
                learners: participants.learners,
                report: s.report
                  ? {
                      summary: s.report.summary,
                      reportedAt: s.report.reportedAt,
                      notions: s.report.notionIds.map((id) => ({
                        id,
                        name: reportNames.get(id) ?? null,
                      })),
                    }
                  : null,
              },
              role,
              // Le lien de la salle n'est donné que pour une séance confirmée.
              visio:
                s.status === "confirmed" && future
                  ? { domain, room: s.room, url: visioUrl(domain, s.room) }
                  : null,
              can: {
                confirm:
                  role === "teacher" && s.status === "requested" && future,
                decline: role === "teacher" && s.status === "requested",
                reschedule: role === "teacher" && blocking && future,
                accept: family && s.status === "proposed" && future,
                cancel: (role === "teacher" || family) && blocking && future,
                report:
                  role === "teacher" &&
                  (s.status === "confirmed" || s.status === "done") &&
                  s.endsAt.getTime() <= now.getTime(),
              },
              notions:
                role === "teacher" ? await store.teacherNotions(userId) : [],
            },
            200,
          );
        },
      )
      .post(
        "/sessions/:id/:action{confirm|decline|accept|cancel}",
        zValidator(
          "param",
          z.object({
            id: uuid,
            action: z.enum(["confirm", "decline", "accept", "cancel"]),
          }),
        ),
        async (c) => {
          const userId = c.get("user").id;
          const { id, action } = c.req.valid("param");
          const s = await store.getSession(id);
          if (!s) return fail(c, 404, "not_found");
          const role = await store.viewerRole(s, userId);
          if (!role) return fail(c, 404, "not_found");
          const teacher = role === "teacher";
          const family = !teacher && (await familyCanAct(store, s, userId));
          if (s.endsAt.getTime() <= deps.now().getTime())
            return fail(c, 409, "session_changed");
          let ok = false;
          if (action === "confirm" && teacher)
            ok = await store.setStatus(s.id, ["requested"], "confirmed");
          else if (action === "decline" && teacher)
            ok = await store.setStatus(s.id, ["requested"], "declined");
          else if (action === "accept" && family)
            ok = await store.setStatus(s.id, ["proposed"], "confirmed");
          else if (action === "cancel" && (teacher || family))
            ok = await store.setStatus(s.id, BLOCKING_STATUSES, "cancelled");
          else return fail(c, 403, "forbidden");
          return ok
            ? c.json({ ok: true }, 200)
            : fail(c, 409, "session_changed");
        },
      )
      // Le prof propose un autre horaire (séance individuelle) ou déplace une séance de groupe.
      .post(
        "/sessions/:id/reschedule",
        zValidator("param", z.object({ id: uuid })),
        zValidator("json", z.object({ startsAt: instant, endsAt: instant })),
        async (c) => {
          const userId = c.get("user").id;
          const s = await store.getSession(c.req.valid("param").id);
          if (!s) return fail(c, 404, "not_found");
          const role = await store.viewerRole(s, userId);
          if (role !== "teacher")
            return role ? fail(c, 403, "forbidden") : fail(c, 404, "not_found");
          const body = c.req.valid("json");
          if (badSessionTimes(body.startsAt, body.endsAt))
            return fail(c, 400, "invalid_range");
          if (body.startsAt.getTime() <= deps.now().getTime())
            return fail(c, 400, "in_past");
          const result = await store.reschedule(
            s,
            await learnersOf(store, s),
            body.startsAt,
            body.endsAt,
            s.kind === "individual" ? "proposed" : "confirmed",
          );
          if (!result.ok)
            return fail(
              c,
              409,
              result.error === "changed" ? "session_changed" : result.error,
            );
          return c.json({ ok: true }, 200);
        },
      )
      // Compte rendu après la séance : il alimente le profil par un événement
      // (source « teacher »), jamais par une écriture directe.
      .post(
        "/sessions/:id/report",
        zValidator("param", z.object({ id: uuid })),
        zValidator(
          "json",
          z.object({
            summary: z.string().trim().min(1).max(1000),
            notionIds: z.array(uuid).max(20).default([]),
          }),
        ),
        async (c) => {
          const userId = c.get("user").id;
          const s = await store.getSession(c.req.valid("param").id);
          if (!s) return fail(c, 404, "not_found");
          const role = await store.viewerRole(s, userId);
          if (role !== "teacher")
            return role ? fail(c, 403, "forbidden") : fail(c, 404, "not_found");
          const body = c.req.valid("json");
          const notionIds = [...new Set(body.notionIds)];
          const allowedNotions = new Set(
            (await store.teacherNotions(userId)).map((n) => n.id),
          );
          if (notionIds.some((id) => !allowedNotions.has(id)))
            return fail(c, 400, "invalid_notion");
          const now = deps.now();
          const result = await recordReport(deps.db, s, {
            summary: body.summary,
            notionIds,
            now,
          });
          if (!result) return fail(c, 409, "session_not_over");
          return c.json({ ok: true, learners: result }, 200);
        },
      )
  );
}

/** Une période de créneaux réservables se lit sur deux mois au plus. */
function badLongRange(from: Date, to: Date): boolean {
  return to.getTime() - from.getTime() > 62 * 86_400_000;
}

/**
 * Enregistre le compte rendu et ajoute, pour chaque élève de la séance, un
 * événement `session.reported` au journal. Renvoie le nombre d'élèves, ou
 * `null` si la séance n'est pas (encore) terminée.
 */
async function recordReport(
  db: SqlExecutor,
  s: TutoringSession,
  input: { summary: string; notionIds: string[]; now: Date },
): Promise<number | null> {
  return db.transaction(async (tx) => {
    const txStore = createAgendaStore(tx);
    if (
      !(await txStore.saveReport(
        s.id,
        input.summary,
        input.notionIds,
        input.now,
      ))
    )
      return null;
    const learners = await learnersOf(txStore, s);
    const events = createEventStore(tx);
    for (const learnerId of learners) {
      const appended = await events.append({
        id: asEventId(randomUUID()),
        learnerId: asLearnerId(learnerId),
        occurredAt: s.endsAt,
        source: "teacher",
        payload: {
          type: "session.reported",
          sessionId: s.id,
          notionIds: input.notionIds.map(asNotionId),
          summary: input.summary,
        },
      });
      if (!appended.ok) throw new Error("identifiant d'événement en conflit");
    }
    return learners.length;
  });
}

// ---------- Rappels ----------

/** Rappel d'une séance, prêt à être remis au module d'envoi. */
export interface AgendaReminder {
  sessionId: string;
  kind: "24h" | "1h";
  startsAt: Date;
  endsAt: Date;
  title: string | null;
  teacherName: string;
  groupName: string | null;
  /** Prof, élèves et parents (liens valables), avec la page de la séance de chacun. */
  recipients: { userId: UserId; role: ViewerRole; path: string }[];
}

/** Ce que le module d'envoi doit fournir pour recevoir les rappels. */
export interface AgendaReminderSender {
  send(reminder: AgendaReminder): Promise<void>;
}

const SPACE_PATH: Record<ViewerRole, string> = {
  teacher: "/prof/agenda/seances",
  learner: "/eleve/agenda/seances",
  guardian: "/parent/agenda/seances",
};

/**
 * Passage des rappels (à appeler toutes les 5 à 15 minutes) : 24 h et 1 h
 * avant chaque séance confirmée. Chaque rappel est réservé en base avant
 * d'être remis : il n'est jamais préparé deux fois, même avec plusieurs
 * serveurs ; un envoi qui échoue n'est pas rejoué (le module d'envoi gère ses
 * propres nouveaux essais).
 */
export async function runAgendaReminders(
  db: SqlExecutor,
  sender: AgendaReminderSender,
  now: Date,
): Promise<{ sent: number; failed: number }> {
  const store = createAgendaStore(db);
  let sent = 0;
  let failed = 0;
  for (const due of await store.claimDueReminders(now)) {
    const s = await store.getSession(due.sessionId);
    if (!s) continue;
    const p = await store.participants(s);
    const recipients = [
      { userId: s.teacherId, role: "teacher" as const },
      ...p.learners.map((l) => ({
        userId: l.userId,
        role: "learner" as const,
      })),
      ...[...new Set(p.guardians.map((g) => g.userId))].map((userId) => ({
        userId,
        role: "guardian" as const,
      })),
    ].map((r) => ({ ...r, path: `${SPACE_PATH[r.role]}/${s.id}` }));
    try {
      await sender.send({
        sessionId: s.id,
        kind: due.kind,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        title: s.title,
        teacherName: s.teacherName,
        groupName: s.groupName,
        recipients,
      });
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}

/**
 * Envoi de développement, tant que le module d'envoi n'est pas branché :
 * seulement le nombre de destinataires dans la console (jamais de nom).
 */
export const consoleReminderSender: AgendaReminderSender = {
  async send(reminder) {
    console.info(
      `[dev] rappel ${reminder.kind} de séance pour ${reminder.recipients.length} personne(s)`,
    );
  },
};
