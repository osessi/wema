import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";
import type { LearnerId, NeedKey, OrganizationId, UserId } from "@wema/domain";
import { asOrganizationId, asUserId, isNeedKey } from "@wema/domain";
import type { SqlExecutor } from "./executor";

/** Besoin déclaré, déchiffré. */
export interface HealthDeclaration {
  id: string;
  need: NeedKey;
  active: boolean;
  declaredBy: UserId | null;
  declaredOrg: OrganizationId;
  declaredRole: "guardian" | "teacher";
  consent: "pending" | "given";
  consentBy: UserId | null;
  consentAt: Date | null;
}

interface Row {
  id: string;
  need_enc: string;
  active: boolean;
  declared_by: string | null;
  declared_org: string;
  declared_role: "guardian" | "teacher";
  consent_status: "pending" | "given";
  consent_by: string | null;
  consent_at: Date | null;
}

const COLUMNS =
  "id, need_enc, active, declared_by, declared_org, declared_role, consent_status, consent_by, consent_at";

/**
 * Données de santé (fiche de décision 0006) : chiffrées avec une clé de
 * 32 octets fournie par le serveur, jamais en clair dans la base.
 */
export function createHealthStore(db: SqlExecutor, key: Buffer) {
  if (key.length !== 32)
    throw new Error("la clé des données de santé doit faire 32 octets");
  const encrypt = (text: string) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), data]
      .map((b) => b.toString("base64"))
      .join(".");
  };
  const decrypt = (stored: string): string => {
    const [iv, tag, data] = stored
      .split(".")
      .map((p) => Buffer.from(p, "base64"));
    if (!iv || !tag || !data) throw new Error("donnée de santé illisible");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  };
  const hash = (learnerId: LearnerId, need: NeedKey) =>
    createHmac("sha256", key).update(`${learnerId}:${need}`).digest("hex");

  const toDeclaration = (r: Row): HealthDeclaration | null => {
    const need = decrypt(r.need_enc);
    if (!isNeedKey(need)) return null;
    return {
      id: r.id,
      need,
      active: r.active,
      declaredBy: r.declared_by === null ? null : asUserId(r.declared_by),
      declaredOrg: asOrganizationId(r.declared_org),
      declaredRole: r.declared_role,
      consent: r.consent_status,
      consentBy: r.consent_by === null ? null : asUserId(r.consent_by),
      consentAt: r.consent_at,
    };
  };

  return {
    /**
     * Déclare (ou met à jour) un besoin. Déclaré par un parent, il est
     * consenti d'emblée ; par un prof, il attend la confirmation d'un parent.
     */
    async declare(input: {
      learnerId: LearnerId;
      need: NeedKey;
      active: boolean;
      declaredBy: UserId;
      declaredOrg: OrganizationId;
      role: "guardian" | "teacher";
    }): Promise<HealthDeclaration | null> {
      const consented = input.role === "guardian";
      const { rows } = await db.query<Row>(
        `INSERT INTO health_declarations (id, learner_id, need_enc, need_hash, active, declared_by, declared_org,
           declared_role, consent_status, consent_by, consent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $11::boolean THEN now() END)
         ON CONFLICT (learner_id, need_hash) DO UPDATE SET active = EXCLUDED.active, declared_by = EXCLUDED.declared_by,
           declared_org = EXCLUDED.declared_org, declared_role = EXCLUDED.declared_role,
           consent_status = CASE WHEN health_declarations.consent_status = 'given' OR EXCLUDED.consent_status = 'given'
             THEN 'given' ELSE 'pending' END,
           consent_by = coalesce(EXCLUDED.consent_by, health_declarations.consent_by),
           consent_at = coalesce(health_declarations.consent_at, EXCLUDED.consent_at),
           updated_at = now()
         RETURNING ${COLUMNS}`,
        [
          randomUUID(),
          input.learnerId,
          encrypt(input.need),
          hash(input.learnerId, input.need),
          input.active,
          input.declaredBy,
          input.declaredOrg,
          input.role,
          consented ? "given" : "pending",
          consented ? input.declaredBy : null,
          consented,
        ],
      );
      return rows[0] ? toDeclaration(rows[0]) : null;
    },

    async list(learnerId: LearnerId): Promise<HealthDeclaration[]> {
      const { rows } = await db.query<Row>(
        `SELECT ${COLUMNS} FROM health_declarations WHERE learner_id = $1 ORDER BY created_at`,
        [learnerId],
      );
      return rows.map(toDeclaration).filter((d) => d !== null);
    },

    /** Consentement d'un parent sur une déclaration en attente ; faux si elle n'existe pas. */
    async giveConsent(input: {
      learnerId: LearnerId;
      id: string;
      guardian: UserId;
    }): Promise<boolean> {
      const { rows } = await db.query(
        `UPDATE health_declarations SET consent_status = 'given', consent_by = $3, consent_at = now(), updated_at = now()
         WHERE id = $1 AND learner_id = $2 RETURNING id`,
        [input.id, input.learnerId, input.guardian],
      );
      return rows.length > 0;
    },

    /** Retrait du consentement : la déclaration est effacée. */
    async remove(input: {
      learnerId: LearnerId;
      id: string;
    }): Promise<boolean> {
      const { rows } = await db.query(
        "DELETE FROM health_declarations WHERE id = $1 AND learner_id = $2 RETURNING id",
        [input.id, input.learnerId],
      );
      return rows.length > 0;
    },

    async share(input: {
      learnerId: LearnerId;
      organizationId: OrganizationId;
      grantedBy: UserId;
    }): Promise<void> {
      await db.query(
        `INSERT INTO health_shares (learner_id, organization_id, granted_by) VALUES ($1, $2, $3)
         ON CONFLICT (learner_id, organization_id) DO NOTHING`,
        [input.learnerId, input.organizationId, input.grantedBy],
      );
    },

    async unshare(input: {
      learnerId: LearnerId;
      organizationId: OrganizationId;
    }): Promise<void> {
      await db.query(
        "DELETE FROM health_shares WHERE learner_id = $1 AND organization_id = $2",
        [input.learnerId, input.organizationId],
      );
    },

    async sharedWith(learnerId: LearnerId): Promise<OrganizationId[]> {
      const { rows } = await db.query<{ organization_id: string }>(
        "SELECT organization_id FROM health_shares WHERE learner_id = $1",
        [learnerId],
      );
      return rows.map((r) => asOrganizationId(r.organization_id));
    },
  };
}

export type HealthStore = ReturnType<typeof createHealthStore>;
