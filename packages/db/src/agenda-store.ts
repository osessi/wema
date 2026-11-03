import { randomBytes, randomUUID } from "node:crypto";
import type { UserId } from "@wema/domain";
import { asUserId } from "@wema/domain";
import type { AvailabilityRule, Interval } from "./agenda-time";
import type { SqlExecutor } from "./executor";
import { ACTIVE_MEMBERS, VALID_GUARDIANSHIPS } from "./message-store";

/**
 * Agenda : disponibilités des profs, groupes de révision et séances en visio.
 * Les liens qui donnent des droits sont exactement ceux de la messagerie
 * (message-store) : prof ↔ élève d'une de ses classes actives, parent ↔ prof
 * d'une classe de son enfant. Ils sont relus à chaque appel.
 */

export type SessionStatus =
  | "requested"
  | "proposed"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "done";

/** Statuts qui occupent le créneau (le prof et l'élève ne sont plus libres). */
export const BLOCKING_STATUSES: readonly SessionStatus[] = [
  "requested",
  "proposed",
  "confirmed",
];

export interface StoredAvailabilityRule extends AvailabilityRule {
  id: string;
  teacherId: UserId;
  slotMinutes: number;
}

export interface TeacherLearner {
  learnerId: UserId;
  displayName: string;
  classId: string;
  className: string;
}

/** Couple prof ↔ élève pour lequel l'utilisateur peut réserver. */
export interface BookableLink {
  teacherId: UserId;
  teacherName: string;
  learnerId: UserId;
  learnerName: string;
  className: string;
  /** `guardian` : réservé par le parent ; `self` : l'élève réserve lui-même. */
  via: "guardian" | "self";
}

export interface StudyGroup {
  id: string;
  teacherId: UserId;
  name: string;
  notionId: string | null;
  notionName: string | null;
  members: { learnerId: UserId; displayName: string; className: string }[];
}

export interface TutoringSession {
  id: string;
  teacherId: UserId;
  teacherName: string;
  kind: "individual" | "group";
  learnerId: UserId | null;
  learnerName: string | null;
  groupId: string | null;
  groupName: string | null;
  groupNotionId: string | null;
  title: string | null;
  startsAt: Date;
  endsAt: Date;
  status: SessionStatus;
  requestedBy: UserId | null;
  requestNote: string | null;
  room: string;
  report: { summary: string; notionIds: string[]; reportedAt: Date } | null;
}

export interface SessionParticipants {
  teacherId: UserId;
  learners: { userId: UserId; displayName: string }[];
  /** Parents (lien valable) des élèves de la séance. */
  guardians: { userId: UserId; learnerId: UserId }[];
}

export type ViewerRole = "teacher" | "learner" | "guardian";

export type CreateSessionError = "teacher_busy" | "learner_busy";

interface SessionRow {
  id: string;
  teacher_id: string;
  teacher_name: string;
  kind: "individual" | "group";
  learner_id: string | null;
  learner_name: string | null;
  group_id: string | null;
  group_name: string | null;
  group_notion_id: string | null;
  title: string | null;
  starts_at: Date;
  ends_at: Date;
  status: SessionStatus;
  requested_by: string | null;
  request_note: string | null;
  room: string;
  report_summary: string | null;
  report_notion_ids: string[] | null;
  reported_at: Date | null;
}

const SESSION_SELECT = `SELECT s.id, s.teacher_id, t.display_name AS teacher_name, s.kind,
    s.learner_id, l.display_name AS learner_name, s.group_id, g.name AS group_name,
    g.notion_id AS group_notion_id, s.title, s.starts_at, s.ends_at, s.status,
    s.requested_by, s.request_note, s.room, s.report_summary, s.report_notion_ids, s.reported_at
  FROM tutoring_sessions s
  JOIN users t ON t.id = s.teacher_id
  LEFT JOIN users l ON l.id = s.learner_id
  LEFT JOIN study_groups g ON g.id = s.group_id`;

const toSession = (r: SessionRow): TutoringSession => ({
  id: r.id,
  teacherId: asUserId(r.teacher_id),
  teacherName: r.teacher_name,
  kind: r.kind,
  learnerId: r.learner_id === null ? null : asUserId(r.learner_id),
  learnerName: r.learner_name,
  groupId: r.group_id,
  groupName: r.group_name,
  groupNotionId: r.group_notion_id,
  title: r.title,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  status: r.status,
  requestedBy: r.requested_by === null ? null : asUserId(r.requested_by),
  requestNote: r.request_note,
  room: r.room,
  report:
    r.report_summary === null || r.reported_at === null
      ? null
      : {
          summary: r.report_summary,
          notionIds: r.report_notion_ids ?? [],
          reportedAt: r.reported_at,
        },
});

/**
 * Nom de salle de visio : 144 bits aléatoires (impossible à deviner), sans
 * rien qui identifie la séance, le prof ou l'élève.
 */
export function newRoomName(): string {
  return `wema-${randomBytes(18).toString("base64url")}`;
}

/** Élèves membres actuels d'un groupe (lien prof ↔ classe encore valable). */
const ACTIVE_GROUP_MEMBERS = `SELECT gm.group_id, gm.learner_id, am.class_name
  FROM study_group_members gm
  JOIN study_groups g ON g.id = gm.group_id
  JOIN (${ACTIVE_MEMBERS}) am ON am.class_id = gm.class_id AND am.user_id = gm.learner_id AND am.role = 'learner'
  JOIN (${ACTIVE_MEMBERS}) at ON at.class_id = gm.class_id AND at.user_id = g.teacher_id AND at.role = 'teacher'`;

export function createAgendaStore(db: SqlExecutor) {
  const store = {
    // ---------- Liens et droits ----------

    /** Élèves des classes actives où l'utilisateur est prof (une ligne par classe). */
    async teacherLearners(teacherId: UserId): Promise<TeacherLearner[]> {
      const { rows } = await db.query<{
        user_id: string;
        display_name: string;
        class_id: string;
        class_name: string;
      }>(
        `WITH am AS (${ACTIVE_MEMBERS})
         SELECT l.user_id, u.display_name, l.class_id, l.class_name
         FROM am me JOIN am l ON l.class_id = me.class_id AND l.role = 'learner'
         JOIN users u ON u.id = l.user_id
         WHERE me.user_id = $1 AND me.role = 'teacher' AND l.user_id <> $1
         ORDER BY u.display_name, l.class_name`,
        [teacherId],
      );
      return rows.map((r) => ({
        learnerId: asUserId(r.user_id),
        displayName: r.display_name,
        classId: r.class_id,
        className: r.class_name,
      }));
    },

    /** Couples prof ↔ élève pour lesquels l'utilisateur peut demander une séance. */
    async bookable(userId: UserId): Promise<BookableLink[]> {
      const { rows } = await db.query<{
        teacher_id: string;
        teacher_name: string;
        learner_id: string;
        learner_name: string;
        class_name: string;
        via: "guardian" | "self";
      }>(
        `WITH am AS (${ACTIVE_MEMBERS}), vg AS (${VALID_GUARDIANSHIPS}),
         links AS (
           -- Parent → profs des classes de ses enfants.
           SELECT t.user_id AS teacher_id, l.user_id AS learner_id, l.class_name, 'guardian' AS via
           FROM vg g JOIN am l ON l.user_id = g.learner_id AND l.role = 'learner'
           JOIN am t ON t.class_id = l.class_id AND t.role = 'teacher'
           WHERE g.guardian_id = $1
           UNION
           -- Élève sans parent lié → profs de ses classes (un élève suivi par
           -- un parent passe par lui).
           SELECT t.user_id, me.user_id, me.class_name, 'self'
           FROM am me JOIN am t ON t.class_id = me.class_id AND t.role = 'teacher'
           WHERE me.user_id = $1 AND me.role = 'learner'
             AND NOT EXISTS (SELECT 1 FROM vg WHERE vg.learner_id = $1)
         )
         SELECT DISTINCT ON (k.teacher_id, k.learner_id) k.teacher_id, t.display_name AS teacher_name,
           k.learner_id, l.display_name AS learner_name, k.class_name, k.via
         FROM links k JOIN users t ON t.id = k.teacher_id JOIN users l ON l.id = k.learner_id
         WHERE k.teacher_id <> k.learner_id
         ORDER BY k.teacher_id, k.learner_id, k.class_name`,
        [userId],
      );
      return rows
        .map((r) => ({
          teacherId: asUserId(r.teacher_id),
          teacherName: r.teacher_name,
          learnerId: asUserId(r.learner_id),
          learnerName: r.learner_name,
          className: r.class_name,
          via: r.via,
        }))
        .sort(
          (a, b) =>
            a.learnerName.localeCompare(b.learnerName) ||
            a.teacherName.localeCompare(b.teacherName),
        );
    },

    /** Enfants (lien valable) de l'utilisateur. */
    async childrenOf(guardianId: UserId): Promise<UserId[]> {
      const { rows } = await db.query<{ learner_id: string }>(
        `SELECT DISTINCT learner_id FROM (${VALID_GUARDIANSHIPS}) vg WHERE vg.guardian_id = $1`,
        [guardianId],
      );
      return rows.map((r) => asUserId(r.learner_id));
    },

    // ---------- Disponibilités ----------

    async listRules(teacherId: UserId): Promise<StoredAvailabilityRule[]> {
      const { rows } = await db.query<{
        id: string;
        teacher_id: string;
        weekdays: number[];
        start_minute: number;
        end_minute: number;
        time_zone: string;
        valid_from: string;
        valid_until: string | null;
        every_n_weeks: number;
        slot_minutes: number;
      }>(
        `SELECT id, teacher_id, weekdays, start_minute, end_minute, time_zone,
           to_char(valid_from, 'YYYY-MM-DD') AS valid_from,
           to_char(valid_until, 'YYYY-MM-DD') AS valid_until, every_n_weeks, slot_minutes
         FROM availability_rules WHERE teacher_id = $1 ORDER BY created_at, id`,
        [teacherId],
      );
      return rows.map((r) => ({
        id: r.id,
        teacherId: asUserId(r.teacher_id),
        weekdays: r.weekdays.map(Number),
        startMinute: r.start_minute,
        endMinute: r.end_minute,
        timeZone: r.time_zone,
        validFrom: r.valid_from,
        validUntil: r.valid_until,
        everyNWeeks: r.every_n_weeks,
        slotMinutes: r.slot_minutes,
      }));
    },

    async addRule(
      teacherId: UserId,
      rule: AvailabilityRule & { slotMinutes: number },
    ): Promise<string> {
      const id = randomUUID();
      await db.query(
        `INSERT INTO availability_rules (id, teacher_id, weekdays, start_minute, end_minute,
           time_zone, valid_from, valid_until, every_n_weeks, slot_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          id,
          teacherId,
          [...new Set(rule.weekdays)].sort(),
          rule.startMinute,
          rule.endMinute,
          rule.timeZone,
          rule.validFrom,
          rule.validUntil,
          rule.everyNWeeks,
          rule.slotMinutes,
        ],
      );
      return id;
    },

    async deleteRule(id: string, teacherId: UserId): Promise<boolean> {
      const { rows } = await db.query(
        "DELETE FROM availability_rules WHERE id = $1 AND teacher_id = $2 RETURNING id",
        [id, teacherId],
      );
      return rows.length > 0;
    },

    // ---------- Groupes de révision ----------

    async listGroups(teacherId: UserId): Promise<StudyGroup[]> {
      const { rows } = await db.query<{
        id: string;
        teacher_id: string;
        name: string;
        notion_id: string | null;
        notion_name: string | null;
      }>(
        `SELECT g.id, g.teacher_id, g.name, g.notion_id, n.name AS notion_name
         FROM study_groups g LEFT JOIN notions n ON n.id = g.notion_id
         WHERE g.teacher_id = $1 AND g.archived_at IS NULL ORDER BY g.created_at, g.id`,
        [teacherId],
      );
      const members = await store.groupMembers(rows.map((r) => r.id));
      return rows.map((r) => ({
        id: r.id,
        teacherId: asUserId(r.teacher_id),
        name: r.name,
        notionId: r.notion_id,
        notionName: r.notion_name,
        members: members.get(r.id) ?? [],
      }));
    },

    /** Membres actuels (lien valable) de chaque groupe. */
    async groupMembers(
      groupIds: string[],
    ): Promise<Map<string, StudyGroup["members"]>> {
      const out = new Map<string, StudyGroup["members"]>();
      if (groupIds.length === 0) return out;
      const { rows } = await db.query<{
        group_id: string;
        learner_id: string;
        display_name: string;
        class_name: string;
      }>(
        `SELECT DISTINCT ON (agm.group_id, agm.learner_id) agm.group_id, agm.learner_id,
           u.display_name, agm.class_name
         FROM (${ACTIVE_GROUP_MEMBERS}) agm JOIN users u ON u.id = agm.learner_id
         WHERE agm.group_id = ANY($1::uuid[])
         ORDER BY agm.group_id, agm.learner_id`,
        [groupIds],
      );
      for (const r of rows) {
        const list = out.get(r.group_id) ?? [];
        list.push({
          learnerId: asUserId(r.learner_id),
          displayName: r.display_name,
          className: r.class_name,
        });
        out.set(r.group_id, list);
      }
      for (const list of out.values())
        list.sort((a, b) => a.displayName.localeCompare(b.displayName));
      return out;
    },

    async getGroup(id: string): Promise<StudyGroup | null> {
      const { rows } = await db.query<{ teacher_id: string }>(
        "SELECT teacher_id FROM study_groups WHERE id = $1 AND archived_at IS NULL",
        [id],
      );
      const teacherId = rows[0]?.teacher_id;
      if (!teacherId) return null;
      return (
        (await store.listGroups(asUserId(teacherId))).find(
          (g) => g.id === id,
        ) ?? null
      );
    },

    /**
     * Crée ou remplace un groupe. Les élèves sont donnés avec la classe du
     * prof par laquelle passe le lien (vérifiée par l'appelant).
     */
    async saveGroup(input: {
      id?: string;
      teacherId: UserId;
      name: string;
      notionId: string | null;
      members: { learnerId: UserId; classId: string }[];
    }): Promise<string> {
      return db.transaction(async (tx) => {
        const id = input.id ?? randomUUID();
        if (input.id) {
          await tx.query(
            "UPDATE study_groups SET name = $3, notion_id = $4 WHERE id = $1 AND teacher_id = $2",
            [id, input.teacherId, input.name, input.notionId],
          );
          await tx.query(
            "DELETE FROM study_group_members WHERE group_id = $1",
            [id],
          );
        } else {
          await tx.query(
            "INSERT INTO study_groups (id, teacher_id, name, notion_id) VALUES ($1, $2, $3, $4)",
            [id, input.teacherId, input.name, input.notionId],
          );
        }
        for (const m of input.members)
          await tx.query(
            `INSERT INTO study_group_members (group_id, learner_id, class_id) VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [id, m.learnerId, m.classId],
          );
        return id;
      });
    },

    async archiveGroup(id: string, teacherId: UserId): Promise<boolean> {
      const { rows } = await db.query(
        `UPDATE study_groups SET archived_at = now()
         WHERE id = $1 AND teacher_id = $2 AND archived_at IS NULL RETURNING id`,
        [id, teacherId],
      );
      return rows.length > 0;
    },

    /** Notions des programmes des classes actives où l'utilisateur est prof. */
    async teacherNotions(
      teacherId: UserId,
    ): Promise<{ id: string; name: string; className: string }[]> {
      const { rows } = await db.query<{
        id: string;
        name: string;
        class_name: string;
      }>(
        `SELECT DISTINCT ON (n.id) n.id, n.name, am.class_name
         FROM (${ACTIVE_MEMBERS}) am
         JOIN classes c ON c.id = am.class_id
         JOIN units u ON u.program_id = c.program_id AND u.archived_at IS NULL
         JOIN notions n ON n.unit_id = u.id AND n.archived_at IS NULL
         WHERE am.user_id = $1 AND am.role = 'teacher'
         ORDER BY n.id, am.class_name`,
        [teacherId],
      );
      return rows
        .map((r) => ({ id: r.id, name: r.name, className: r.class_name }))
        .sort(
          (a, b) =>
            a.className.localeCompare(b.className) ||
            a.name.localeCompare(b.name),
        );
    },

    // ---------- Séances ----------

    /** Séances qui occupent le prof ou l'un des élèves sur la période. */
    async busy(input: {
      teacherId: UserId | null;
      learnerIds: UserId[];
      from: Date;
      to: Date;
      excludeSessionId?: string;
    }): Promise<(Interval & { teacher: boolean })[]> {
      const { rows } = await db.query<{
        starts_at: Date;
        ends_at: Date;
        teacher: boolean;
      }>(
        `SELECT s.starts_at, s.ends_at, (s.teacher_id = $3) AS teacher
         FROM tutoring_sessions s
         WHERE s.status = ANY($6::text[]) AND s.starts_at < $2 AND s.ends_at > $1
           AND s.id IS DISTINCT FROM $5::uuid
           AND (s.teacher_id = $3
             OR s.learner_id = ANY($4::uuid[])
             OR EXISTS (SELECT 1 FROM (${ACTIVE_GROUP_MEMBERS}) agm
                        WHERE agm.group_id = s.group_id AND agm.learner_id = ANY($4::uuid[])))`,
        [
          input.from.toISOString(),
          input.to.toISOString(),
          input.teacherId,
          input.learnerIds,
          input.excludeSessionId ?? null,
          BLOCKING_STATUSES,
        ],
      );
      return rows.map((r) => ({
        start: r.starts_at,
        end: r.ends_at,
        teacher: r.teacher === true,
      }));
    },

    /**
     * Crée une séance si ni le prof ni les élèves ne sont déjà pris. Un
     * verrou par personne (dans un ordre fixe) évite qu'une double réservation
     * simultanée passe entre la vérification et l'écriture.
     */
    async createSession(input: {
      teacherId: UserId;
      kind: "individual" | "group";
      learnerId: UserId | null;
      groupId: string | null;
      learnerIds: UserId[];
      title: string | null;
      startsAt: Date;
      endsAt: Date;
      status: "requested" | "confirmed";
      requestedBy: UserId | null;
      requestNote: string | null;
    }): Promise<
      { ok: true; id: string } | { ok: false; error: CreateSessionError }
    > {
      return db.transaction(async (tx) => {
        const conflict = await lockAndCheck(createAgendaStore(tx), tx, {
          teacherId: input.teacherId,
          learnerIds: input.learnerIds,
          from: input.startsAt,
          to: input.endsAt,
        });
        if (conflict) return { ok: false as const, error: conflict };
        const id = randomUUID();
        await tx.query(
          `INSERT INTO tutoring_sessions (id, teacher_id, kind, learner_id, group_id, title,
             starts_at, ends_at, status, requested_by, request_note, room)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            id,
            input.teacherId,
            input.kind,
            input.learnerId,
            input.groupId,
            input.title,
            input.startsAt.toISOString(),
            input.endsAt.toISOString(),
            input.status,
            input.requestedBy,
            input.requestNote,
            newRoomName(),
          ],
        );
        return { ok: true as const, id };
      });
    },

    async getSession(id: string): Promise<TutoringSession | null> {
      const { rows } = await db.query<SessionRow>(
        `${SESSION_SELECT} WHERE s.id = $1`,
        [id],
      );
      const r = rows[0];
      return r ? toSession(r) : null;
    },

    /** Élèves et parents d'une séance (liens valables à cet instant). */
    async participants(session: TutoringSession): Promise<SessionParticipants> {
      let learners: { userId: UserId; displayName: string }[] = [];
      if (session.kind === "individual" && session.learnerId) {
        learners = [
          {
            userId: session.learnerId,
            displayName: session.learnerName ?? "",
          },
        ];
      } else if (session.groupId) {
        learners = (
          (await store.groupMembers([session.groupId])).get(session.groupId) ??
          []
        ).map((m) => ({ userId: m.learnerId, displayName: m.displayName }));
      }
      const ids = learners.map((l) => l.userId);
      const { rows } =
        ids.length === 0
          ? { rows: [] }
          : await db.query<{ guardian_id: string; learner_id: string }>(
              `SELECT DISTINCT guardian_id, learner_id FROM (${VALID_GUARDIANSHIPS}) vg
               WHERE vg.learner_id = ANY($1::uuid[]) ORDER BY guardian_id, learner_id`,
              [ids],
            );
      return {
        teacherId: session.teacherId,
        learners,
        guardians: rows.map((r) => ({
          userId: asUserId(r.guardian_id),
          learnerId: asUserId(r.learner_id),
        })),
      };
    },

    /** Place de l'utilisateur dans la séance, ou `null` s'il n'y a pas accès. */
    async viewerRole(
      session: TutoringSession,
      userId: UserId,
    ): Promise<ViewerRole | null> {
      if (session.teacherId === userId) return "teacher";
      const p = await store.participants(session);
      if (p.learners.some((l) => l.userId === userId)) return "learner";
      if (p.guardians.some((g) => g.userId === userId)) return "guardian";
      return null;
    },

    /** Séances de la période : celles du prof, ou celles des élèves donnés. */
    async listSessions(
      filter: { teacherId: UserId } | { learnerIds: UserId[] },
      from: Date,
      to: Date,
    ): Promise<(TutoringSession & { learnerIds: UserId[] })[]> {
      const byTeacher = "teacherId" in filter;
      const { rows } = await db.query<SessionRow & { member_ids: string[] }>(
        `${SESSION_SELECT.replace(
          "SELECT s.id,",
          `SELECT ARRAY(SELECT agm.learner_id FROM (${ACTIVE_GROUP_MEMBERS}) agm WHERE agm.group_id = s.group_id)::text[] AS member_ids, s.id,`,
        )}
         WHERE s.starts_at < $2 AND s.ends_at > $1 AND ${
           byTeacher
             ? "s.teacher_id = $3"
             : `(s.learner_id = ANY($3::uuid[]) OR EXISTS (SELECT 1 FROM (${ACTIVE_GROUP_MEMBERS}) agm
                 WHERE agm.group_id = s.group_id AND agm.learner_id = ANY($3::uuid[])))`
         }
         ORDER BY s.starts_at, s.id`,
        [
          from.toISOString(),
          to.toISOString(),
          byTeacher ? filter.teacherId : filter.learnerIds,
        ],
      );
      return rows.map((r) => {
        const s = toSession(r);
        return {
          ...s,
          learnerIds: s.learnerId
            ? [s.learnerId]
            : (r.member_ids ?? []).map(asUserId),
        };
      });
    },

    /** Demandes et propositions en attente pour un prof. */
    async pendingForTeacher(teacherId: UserId): Promise<TutoringSession[]> {
      const { rows } = await db.query<SessionRow>(
        `${SESSION_SELECT} WHERE s.teacher_id = $1 AND s.status IN ('requested', 'proposed')
           AND s.ends_at > now() ORDER BY s.starts_at`,
        [teacherId],
      );
      return rows.map(toSession);
    },

    /**
     * Change le statut si la séance est encore dans l'un des statuts
     * attendus (sinon, quelqu'un est passé avant : `false`).
     */
    async setStatus(
      id: string,
      from: readonly SessionStatus[],
      to: SessionStatus,
    ): Promise<boolean> {
      const { rows } = await db.query(
        `UPDATE tutoring_sessions SET status = $3, updated_at = now()
         WHERE id = $1 AND status = ANY($2::text[]) RETURNING id`,
        [id, from, to],
      );
      return rows.length > 0;
    },

    /**
     * Nouvel horaire choisi par le prof : `proposed` (la famille doit
     * l'accepter) pour une séance individuelle, `confirmed` pour un groupe.
     */
    async reschedule(
      session: TutoringSession,
      learnerIds: UserId[],
      startsAt: Date,
      endsAt: Date,
      status: "proposed" | "confirmed",
    ): Promise<
      { ok: true } | { ok: false; error: CreateSessionError | "changed" }
    > {
      return db.transaction(async (tx) => {
        const conflict = await lockAndCheck(createAgendaStore(tx), tx, {
          teacherId: session.teacherId,
          learnerIds,
          from: startsAt,
          to: endsAt,
          excludeSessionId: session.id,
        });
        if (conflict) return { ok: false as const, error: conflict };
        const { rows } = await tx.query(
          `UPDATE tutoring_sessions SET starts_at = $2, ends_at = $3, status = $4,
             reminded_24h_at = NULL, reminded_1h_at = NULL, updated_at = now()
           WHERE id = $1 AND status IN ('requested', 'proposed', 'confirmed') RETURNING id`,
          [session.id, startsAt.toISOString(), endsAt.toISOString(), status],
        );
        return rows.length > 0
          ? { ok: true as const }
          : { ok: false as const, error: "changed" as const };
      });
    },

    /** Noms des notions (pour afficher un compte rendu). */
    async notionNames(ids: readonly string[]): Promise<Map<string, string>> {
      if (ids.length === 0) return new Map();
      const { rows } = await db.query<{ id: string; name: string }>(
        "SELECT id, name FROM notions WHERE id = ANY($1::uuid[])",
        [ids],
      );
      return new Map(rows.map((r) => [r.id, r.name]));
    },

    async saveReport(
      id: string,
      summary: string,
      notionIds: string[],
      now: Date,
    ): Promise<boolean> {
      const { rows } = await db.query(
        `UPDATE tutoring_sessions SET report_summary = $2, report_notion_ids = $3::uuid[],
           reported_at = $4, status = 'done', updated_at = now()
         WHERE id = $1 AND status IN ('confirmed', 'done') AND ends_at <= $4 RETURNING id`,
        [id, summary, notionIds, now.toISOString()],
      );
      return rows.length > 0;
    },

    /**
     * Réserve les rappels dus (24 h et 1 h avant les séances confirmées) et
     * les renvoie. La réservation est atomique : deux serveurs ne préparent
     * jamais le même rappel. Une séance déjà à moins d'une heure ne reçoit
     * que le rappel « 1 h ».
     */
    async claimDueReminders(
      now: Date,
    ): Promise<{ sessionId: string; kind: "24h" | "1h" }[]> {
      const { rows } = await db.query<{ id: string; kind: "24h" | "1h" }>(
        `WITH due AS (
           SELECT id, CASE WHEN starts_at <= $1::timestamptz + interval '1 hour' THEN '1h' ELSE '24h' END AS kind
           FROM tutoring_sessions
           WHERE status = 'confirmed' AND starts_at > $1
             AND ((starts_at <= $1::timestamptz + interval '1 hour' AND reminded_1h_at IS NULL)
               OR (starts_at <= $1::timestamptz + interval '24 hours' AND reminded_24h_at IS NULL))
           FOR UPDATE SKIP LOCKED
         )
         UPDATE tutoring_sessions s SET
           reminded_1h_at = CASE WHEN due.kind = '1h' THEN $1::timestamptz ELSE s.reminded_1h_at END,
           reminded_24h_at = coalesce(s.reminded_24h_at, $1::timestamptz)
         FROM due WHERE s.id = due.id
         RETURNING s.id, due.kind`,
        [now.toISOString()],
      );
      return rows.map((r) => ({ sessionId: r.id, kind: r.kind }));
    },
  };
  return store;
}

/** Verrouille le prof et les élèves (ordre fixe), puis cherche un conflit. */
async function lockAndCheck(
  store: AgendaStore,
  tx: SqlExecutor,
  input: {
    teacherId: UserId;
    learnerIds: UserId[];
    from: Date;
    to: Date;
    excludeSessionId?: string;
  },
): Promise<CreateSessionError | null> {
  for (const id of [...new Set([input.teacherId, ...input.learnerIds])].sort())
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `agenda:${id}`,
    ]);
  const busy = await store.busy(input);
  if (busy.some((b) => b.teacher)) return "teacher_busy";
  if (busy.length > 0) return "learner_busy";
  return null;
}

export type AgendaStore = ReturnType<typeof createAgendaStore>;
