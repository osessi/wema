import { randomUUID } from "node:crypto";
import type {
  DiagnosticSheet,
  DiagnosticStatus,
  PreferenceKey,
  UserId,
} from "@wema/domain";
import {
  asUserId,
  DIAGNOSTIC_SHEET_FIELDS,
  isPreferenceKey,
} from "@wema/domain";
import { createAgendaStore, newRoomName } from "./agenda-store";
import type { Interval } from "./agenda-time";
import type { SqlExecutor } from "./executor";
import { VALID_GUARDIANSHIPS } from "./message-store";

/**
 * Rendez-vous de diagnostic avec un conseiller Wema (après le paiement). Le
 * conseiller est un membre de l'organisation plateforme dont un rôle porte
 * « diagnostic.conduct » ; ses disponibilités sont celles de l'agenda
 * (availability_rules). La fiche n'alimente jamais le profil directement :
 * la route publie un événement « diagnostic.reported ».
 */

export interface DiagnosticHypothesis {
  key: PreferenceKey;
  label: string | null;
  value: boolean;
  confidence: number;
}

export interface DiagnosticAppointment {
  id: string;
  advisorId: UserId;
  advisorName: string;
  learnerId: UserId;
  learnerName: string;
  bookedBy: UserId | null;
  startsAt: Date;
  endsAt: Date;
  status: DiagnosticStatus;
  room: string;
  sheet: DiagnosticSheet;
  hypotheses: DiagnosticHypothesis[];
  notes: string;
  reportedAt: Date | null;
}

export type BookDiagnosticError =
  | "advisor_busy"
  | "learner_busy"
  | "already_booked";

export const EMPTY_SHEET: DiagnosticSheet = {
  since: "",
  where: "",
  blockers: "",
  motivation: "",
  learningStyle: "",
  needs: "",
};

interface Row {
  id: string;
  advisor_id: string;
  advisor_name: string;
  learner_id: string;
  learner_name: string;
  booked_by: string | null;
  starts_at: Date;
  ends_at: Date;
  status: DiagnosticStatus;
  room: string;
  sheet: unknown;
  hypotheses: unknown;
  notes: string;
  reported_at: Date | null;
}

const SELECT = `SELECT d.id, d.advisor_id, a.display_name AS advisor_name, d.learner_id,
    l.display_name AS learner_name, d.booked_by, d.starts_at, d.ends_at, d.status, d.room,
    d.sheet, d.hypotheses, d.notes, d.reported_at
  FROM diagnostic_appointments d
  JOIN users a ON a.id = d.advisor_id
  JOIN users l ON l.id = d.learner_id`;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Relit la fiche stockée (jsonb) : rubriques connues, textes seulement. */
function readSheet(value: unknown): DiagnosticSheet {
  const out: Record<string, string> = { ...EMPTY_SHEET };
  if (isRecord(value))
    for (const field of DIAGNOSTIC_SHEET_FIELDS) {
      const v = value[field];
      if (typeof v === "string") out[field] = v;
    }
  return {
    since: out.since ?? "",
    where: out.where ?? "",
    blockers: out.blockers ?? "",
    motivation: out.motivation ?? "",
    learningStyle: out.learningStyle ?? "",
    needs: out.needs ?? "",
  };
}

function readHypotheses(value: unknown): DiagnosticHypothesis[] {
  if (!Array.isArray(value)) return [];
  const out: DiagnosticHypothesis[] = [];
  for (const h of value) {
    if (!isRecord(h) || typeof h.key !== "string" || !isPreferenceKey(h.key))
      continue;
    out.push({
      key: h.key,
      label: typeof h.label === "string" ? h.label : null,
      value: h.value !== false,
      confidence:
        typeof h.confidence === "number"
          ? Math.min(1, Math.max(0, h.confidence))
          : 0.5,
    });
  }
  return out;
}

const toAppointment = (r: Row): DiagnosticAppointment => ({
  id: r.id,
  advisorId: asUserId(r.advisor_id),
  advisorName: r.advisor_name,
  learnerId: asUserId(r.learner_id),
  learnerName: r.learner_name,
  bookedBy: r.booked_by === null ? null : asUserId(r.booked_by),
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  status: r.status,
  room: r.room,
  sheet: readSheet(r.sheet),
  hypotheses: readHypotheses(r.hypotheses),
  notes: r.notes,
  reportedAt: r.reported_at,
});

export function createDiagnosticStore(db: SqlExecutor) {
  const store = {
    /** Conseillers : membres de la plateforme avec « diagnostic.conduct ». */
    async advisors(): Promise<UserId[]> {
      const { rows } = await db.query<{ user_id: string }>(
        `SELECT DISTINCT m.user_id FROM memberships m
         JOIN organizations o ON o.id = m.organization_id AND o.kind = 'platform'
         JOIN roles r ON r.id = m.role_id
         WHERE 'diagnostic.conduct' = ANY(r.permissions)
         ORDER BY m.user_id`,
      );
      return rows.map((r) => asUserId(r.user_id));
    },

    /** Le parent a-t-il un lien valable avec cet enfant ? */
    async isGuardianOf(
      guardianId: UserId,
      learnerId: string,
    ): Promise<boolean> {
      const { rows } = await db.query(
        `SELECT 1 FROM (${VALID_GUARDIANSHIPS}) vg WHERE vg.guardian_id = $1 AND vg.learner_id = $2`,
        [guardianId, learnerId],
      );
      return rows.length > 0;
    },

    async get(id: string): Promise<DiagnosticAppointment | null> {
      const { rows } = await db.query<Row>(`${SELECT} WHERE d.id = $1`, [id]);
      return rows[0] ? toAppointment(rows[0]) : null;
    },

    async listForLearners(
      learnerIds: readonly string[],
    ): Promise<DiagnosticAppointment[]> {
      if (learnerIds.length === 0) return [];
      const { rows } = await db.query<Row>(
        `${SELECT} WHERE d.learner_id = ANY($1::uuid[]) ORDER BY d.starts_at DESC`,
        [[...learnerIds]],
      );
      return rows.map(toAppointment);
    },

    async listForAdvisor(advisorId: UserId): Promise<DiagnosticAppointment[]> {
      const { rows } = await db.query<Row>(
        `${SELECT} WHERE d.advisor_id = $1 ORDER BY d.starts_at DESC LIMIT 500`,
        [advisorId],
      );
      return rows.map(toAppointment);
    },

    /** Créneaux déjà pris par un conseiller : diagnostics prévus et séances de l'agenda. */
    async advisorBusy(
      advisorId: UserId,
      from: Date,
      to: Date,
    ): Promise<Interval[]> {
      const { rows } = await db.query<{ starts_at: Date; ends_at: Date }>(
        `SELECT starts_at, ends_at FROM diagnostic_appointments
         WHERE advisor_id = $1 AND status = 'booked' AND starts_at < $3 AND ends_at > $2`,
        [advisorId, from.toISOString(), to.toISOString()],
      );
      const sessions = await createAgendaStore(db).busy({
        teacherId: advisorId,
        learnerIds: [],
        from,
        to,
      });
      return [
        ...rows.map((r) => ({ start: r.starts_at, end: r.ends_at })),
        ...sessions.map((s) => ({ start: s.start, end: s.end })),
      ];
    },

    /**
     * Réserve un créneau. Le conseiller et l'élève sont verrouillés (mêmes
     * verrous que l'agenda) avant de vérifier qu'ils sont libres ; l'index
     * unique garantit un seul rendez-vous prévu ou fait par élève.
     */
    async book(input: {
      advisorId: UserId;
      learnerId: UserId;
      bookedBy: UserId;
      startsAt: Date;
      endsAt: Date;
    }): Promise<
      { ok: true; id: string } | { ok: false; error: BookDiagnosticError }
    > {
      return db.transaction(async (tx) => {
        for (const id of [input.advisorId, input.learnerId].sort())
          await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
            `agenda:${id}`,
          ]);
        const mine = createDiagnosticStore(tx);
        const overlap = (b: Interval) =>
          b.start.getTime() < input.endsAt.getTime() &&
          input.startsAt.getTime() < b.end.getTime();
        if (
          (
            await mine.advisorBusy(
              input.advisorId,
              input.startsAt,
              input.endsAt,
            )
          ).some(overlap)
        )
          return { ok: false as const, error: "advisor_busy" as const };
        const learnerBusy = await createAgendaStore(tx).busy({
          teacherId: null,
          learnerIds: [input.learnerId],
          from: input.startsAt,
          to: input.endsAt,
        });
        if (learnerBusy.length > 0)
          return { ok: false as const, error: "learner_busy" as const };
        const { rows } = await tx.query(
          "SELECT 1 FROM diagnostic_appointments WHERE learner_id = $1 AND status <> 'cancelled'",
          [input.learnerId],
        );
        if (rows.length > 0)
          return { ok: false as const, error: "already_booked" as const };
        const id = randomUUID();
        await tx.query(
          `INSERT INTO diagnostic_appointments (id, advisor_id, learner_id, booked_by,
             starts_at, ends_at, status, room)
           VALUES ($1, $2, $3, $4, $5, $6, 'booked', $7)`,
          [
            id,
            input.advisorId,
            input.learnerId,
            input.bookedBy,
            input.startsAt.toISOString(),
            input.endsAt.toISOString(),
            newRoomName(),
          ],
        );
        return { ok: true as const, id };
      });
    },

    /** Annule un rendez-vous prévu qui n'a pas encore commencé. */
    async cancel(id: string, now: Date): Promise<boolean> {
      const { rows } = await db.query(
        `UPDATE diagnostic_appointments SET status = 'cancelled', updated_at = now()
         WHERE id = $1 AND status = 'booked' AND starts_at > $2 RETURNING id`,
        [id, now.toISOString()],
      );
      return rows.length > 0;
    },

    /**
     * Enregistre le brouillon du conseiller. La fiche et les hypothèses ne
     * changent plus une fois le compte rendu publié ; les notes, si.
     */
    async saveSheet(input: {
      id: string;
      advisorId: UserId;
      sheet: DiagnosticSheet;
      hypotheses: readonly DiagnosticHypothesis[];
      notes: string;
    }): Promise<boolean> {
      const { rows } = await db.query(
        `UPDATE diagnostic_appointments SET
           sheet = CASE WHEN status = 'booked' THEN $3::jsonb ELSE sheet END,
           hypotheses = CASE WHEN status = 'booked' THEN $4::jsonb ELSE hypotheses END,
           notes = $5, updated_at = now()
         WHERE id = $1 AND advisor_id = $2 AND status <> 'cancelled' RETURNING id`,
        [
          input.id,
          input.advisorId,
          JSON.stringify(input.sheet),
          JSON.stringify(input.hypotheses),
          input.notes,
        ],
      );
      return rows.length > 0;
    },

    /** Marque le compte rendu publié (dans la transaction qui ajoute l'événement). */
    async markReported(
      id: string,
      advisorId: UserId,
      eventId: string,
      now: Date,
    ): Promise<boolean> {
      const { rows } = await db.query(
        `UPDATE diagnostic_appointments SET status = 'done', report_event_id = $3,
           reported_at = $4, updated_at = now()
         WHERE id = $1 AND advisor_id = $2 AND status = 'booked' AND starts_at <= $4
         RETURNING id`,
        [id, advisorId, eventId, now.toISOString()],
      );
      return rows.length > 0;
    },
  };
  return store;
}

export type DiagnosticStore = ReturnType<typeof createDiagnosticStore>;
