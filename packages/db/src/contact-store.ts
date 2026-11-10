import { randomUUID } from "node:crypto";
import type { SqlExecutor } from "./executor";

/** Profil déclaré dans le formulaire de contact du site public. */
export const CONTACT_PROFILES = [
  "parent",
  "eleve",
  "prof",
  "ecole",
  "autre",
] as const;
export type ContactProfile = (typeof CONTACT_PROFILES)[number];

export interface ContactRequest {
  id: string;
  createdAt: Date;
  name: string;
  email: string;
  profile: ContactProfile;
  organization: string | null;
  message: string;
  handledAt: Date | null;
}

export interface NewContactRequest {
  name: string;
  email: string;
  profile: ContactProfile;
  organization: string | null;
  message: string;
  /** Empreinte de l'adresse IP (jamais l'adresse en clair). */
  ipHash: string;
}

interface Row {
  id: string;
  created_at: Date;
  name: string;
  email: string;
  profile: string;
  organization: string | null;
  message: string;
  handled_at: Date | null;
}

const isProfile = (value: string): value is ContactProfile =>
  CONTACT_PROFILES.some((p) => p === value);

const toRequest = (r: Row): ContactRequest => ({
  id: r.id,
  createdAt: r.created_at,
  name: r.name,
  email: r.email,
  // La contrainte de la table garantit la valeur ; « autre » par prudence.
  profile: isProfile(r.profile) ? r.profile : "autre",
  organization: r.organization,
  message: r.message,
  handledAt: r.handled_at,
});

const COLUMNS =
  "id, created_at, name, email, profile, organization, message, handled_at";

/** Demandes de contact du site public (migration 0028). */
export function createContactStore(db: SqlExecutor) {
  return {
    async create(input: NewContactRequest): Promise<ContactRequest> {
      const { rows } = await db.query<Row>(
        `INSERT INTO contact_requests (id, name, email, profile, organization, message, ip_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNS}`,
        [
          randomUUID(),
          input.name,
          input.email,
          input.profile,
          input.organization,
          input.message,
          input.ipHash,
        ],
      );
      const row = rows[0];
      if (!row) throw new Error("demande de contact non enregistrée");
      return toRequest(row);
    },

    /** Les plus récentes d'abord ; `total` compte toutes les demandes. */
    async list(input: {
      limit: number;
      offset: number;
    }): Promise<{ requests: ContactRequest[]; total: number }> {
      const [{ rows }, count] = await Promise.all([
        db.query<Row>(
          `SELECT ${COLUMNS} FROM contact_requests
           ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`,
          [input.limit, input.offset],
        ),
        db.query<{ total: number }>(
          "SELECT count(*)::int AS total FROM contact_requests",
        ),
      ]);
      return {
        requests: rows.map(toRequest),
        total: count.rows[0]?.total ?? 0,
      };
    },

    /**
     * Marque la demande comme traitée (la première date est gardée si elle
     * l'était déjà). `null` : demande introuvable.
     */
    async markHandled(id: string, at: Date): Promise<ContactRequest | null> {
      const { rows } = await db.query<Row>(
        `UPDATE contact_requests SET handled_at = COALESCE(handled_at, $2)
         WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, at],
      );
      const row = rows[0];
      return row ? toRequest(row) : null;
    },
  };
}

export type ContactStore = ReturnType<typeof createContactStore>;
