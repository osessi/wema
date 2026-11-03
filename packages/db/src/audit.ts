import { randomUUID } from "node:crypto";
import type { OrganizationId, UserId } from "@wema/domain";
import { asOrganizationId, asUserId } from "@wema/domain";
import type { SqlExecutor } from "./executor";

/** Trace d'une action d'administration ; le journal est en ajout seul. */
export interface AuditEntry {
  id: string;
  at: Date;
  actorId: UserId | null;
  actorName: string | null;
  organizationId: OrganizationId | null;
  /** Ex. notion.create, role.update, member.remove. */
  action: string;
  targetType: string;
  targetId: string | null;
  /** Identifiants et valeurs modifiées ; jamais de secret ni de donnée de santé. */
  details: Record<string, unknown>;
}

export type NewAuditEntry = Omit<AuditEntry, "id" | "at" | "actorName">;

export function createAuditLog(db: SqlExecutor) {
  return {
    async append(entry: NewAuditEntry): Promise<void> {
      await db.query(
        `INSERT INTO audit_log (id, actor_id, organization_id, action, target_type, target_id, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [
          randomUUID(),
          entry.actorId,
          entry.organizationId,
          entry.action,
          entry.targetType,
          entry.targetId,
          JSON.stringify(entry.details),
        ],
      );
    },

    /** Entrées les plus récentes d'abord ; sans organisation, tout le journal. */
    async list(input: {
      organizationId?: OrganizationId;
      limit: number;
    }): Promise<AuditEntry[]> {
      const { rows } = await db.query<{
        id: string;
        at: Date;
        actor_id: string | null;
        display_name: string | null;
        organization_id: string | null;
        action: string;
        target_type: string;
        target_id: string | null;
        details: Record<string, unknown>;
      }>(
        `SELECT a.id, a.at, a.actor_id, u.display_name, a.organization_id, a.action, a.target_type,
           a.target_id, a.details
         FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
         WHERE $1::uuid IS NULL OR a.organization_id = $1
         ORDER BY a.at DESC, a.id DESC LIMIT $2`,
        [input.organizationId ?? null, input.limit],
      );
      return rows.map((r) => ({
        id: r.id,
        at: r.at,
        actorId: r.actor_id === null ? null : asUserId(r.actor_id),
        actorName: r.display_name,
        organizationId:
          r.organization_id === null
            ? null
            : asOrganizationId(r.organization_id),
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        details: r.details,
      }));
    },
  };
}

export type AuditLog = ReturnType<typeof createAuditLog>;
