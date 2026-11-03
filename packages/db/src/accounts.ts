import { randomUUID } from "node:crypto";
import type {
  Membership,
  OrganizationId,
  OrganizationKind,
  UserId,
} from "@wema/domain";
import {
  asOrganizationId,
  asRoleId,
  asUserId,
  isPermission,
} from "@wema/domain";
import type { SqlExecutor } from "./executor";

export type IdentityKind = "email" | "phone" | "google" | "apple" | "username";

export interface User {
  id: UserId;
  displayName: string;
  createdBy: UserId | null;
  disabled: boolean;
}

export interface Identity {
  id: string;
  userId: UserId;
  kind: IdentityKind;
  identifier: string;
  secretHash: string | null;
  verified: boolean;
}

export interface StoredOneTimeCode {
  id: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
}

interface UserRow {
  id: string;
  display_name: string;
  created_by: string | null;
  disabled_at: Date | null;
}

interface IdentityRow {
  id: string;
  user_id: string;
  kind: IdentityKind;
  identifier: string;
  secret_hash: string | null;
  verified_at: Date | null;
}

const toUser = (r: UserRow): User => ({
  id: asUserId(r.id),
  displayName: r.display_name,
  createdBy: r.created_by === null ? null : asUserId(r.created_by),
  disabled: r.disabled_at !== null,
});

const toIdentity = (r: IdentityRow): Identity => ({
  id: r.id,
  userId: asUserId(r.user_id),
  kind: r.kind,
  identifier: r.identifier,
  secretHash: r.secret_hash,
  verified: r.verified_at !== null,
});

export function createAccountStore(db: SqlExecutor) {
  return {
    async createUser(input: {
      displayName: string;
      createdBy: UserId | null;
      /** Organisation propriétaire d'un compte créé pour quelqu'un (élève géré). */
      ownerOrganizationId?: OrganizationId | undefined;
    }): Promise<User> {
      const { rows } = await db.query<UserRow>(
        `INSERT INTO users (id, display_name, created_by, owner_organization_id) VALUES ($1, $2, $3, $4)
         RETURNING id, display_name, created_by, disabled_at`,
        [
          randomUUID(),
          input.displayName,
          input.createdBy,
          input.ownerOrganizationId ?? null,
        ],
      );
      const row = rows[0];
      if (!row) throw new Error("création d'utilisateur sans retour");
      return toUser(row);
    },

    async ownerOrganization(id: UserId): Promise<OrganizationId | null> {
      const { rows } = await db.query<{ owner_organization_id: string | null }>(
        "SELECT owner_organization_id FROM users WHERE id = $1",
        [id],
      );
      const owner = rows[0]?.owner_organization_id;
      return owner ? asOrganizationId(owner) : null;
    },

    /** Ferme toutes les sessions d'un utilisateur (après un changement de secret). */
    async deleteUserSessions(id: UserId): Promise<void> {
      await db.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    },

    async getUser(id: UserId): Promise<User | null> {
      const { rows } = await db.query<UserRow>(
        "SELECT id, display_name, created_by, disabled_at FROM users WHERE id = $1",
        [id],
      );
      return rows[0] ? toUser(rows[0]) : null;
    },

    /** Renvoie `null` si cet identifiant est déjà pris (contrainte d'unicité). */
    async addIdentity(input: {
      userId: UserId;
      kind: IdentityKind;
      identifier: string;
      secretHash: string | null;
      verified: boolean;
    }): Promise<Identity | null> {
      const { rows } = await db.query<IdentityRow>(
        `INSERT INTO identities (id, user_id, kind, identifier, secret_hash, verified_at)
         VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::boolean THEN now() END)
         ON CONFLICT (kind, identifier) DO NOTHING
         RETURNING id, user_id, kind, identifier, secret_hash, verified_at`,
        [
          randomUUID(),
          input.userId,
          input.kind,
          input.identifier,
          input.secretHash,
          input.verified,
        ],
      );
      return rows[0] ? toIdentity(rows[0]) : null;
    },

    async findIdentity(
      kind: IdentityKind,
      identifier: string,
    ): Promise<Identity | null> {
      const { rows } = await db.query<IdentityRow>(
        `SELECT id, user_id, kind, identifier, secret_hash, verified_at
         FROM identities WHERE kind = $1 AND identifier = $2`,
        [kind, identifier],
      );
      return rows[0] ? toIdentity(rows[0]) : null;
    },

    async listIdentities(userId: UserId): Promise<Identity[]> {
      const { rows } = await db.query<IdentityRow>(
        `SELECT id, user_id, kind, identifier, secret_hash, verified_at
         FROM identities WHERE user_id = $1 ORDER BY created_at`,
        [userId],
      );
      return rows.map(toIdentity);
    },

    async setIdentitySecret(
      identityId: string,
      secretHash: string,
    ): Promise<void> {
      await db.query("UPDATE identities SET secret_hash = $2 WHERE id = $1", [
        identityId,
        secretHash,
      ]);
    },

    async createSession(input: {
      tokenHash: string;
      userId: UserId;
      expiresAt: Date;
    }): Promise<void> {
      await db.query(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
        [input.tokenHash, input.userId, input.expiresAt.toISOString()],
      );
    },

    /**
     * Utilisateur d'une session valide, ou `null` (session inconnue, expirée,
     * ou compte désactivé). Prolonge la session à chaque usage, sans dépasser
     * `maxAgeMs` depuis son ouverture.
     */
    async useSession(
      tokenHash: string,
      now: Date,
      ttlMs: number,
      maxAgeMs: number,
    ): Promise<User | null> {
      const { rows } = await db.query<UserRow>(
        `UPDATE sessions s SET last_seen_at = $2, expires_at = $3
         FROM users u
         WHERE s.token_hash = $1 AND s.expires_at > $2 AND s.created_at > $4
           AND u.id = s.user_id AND u.disabled_at IS NULL
         RETURNING u.id, u.display_name, u.created_by, u.disabled_at`,
        [
          tokenHash,
          now.toISOString(),
          new Date(now.getTime() + ttlMs).toISOString(),
          new Date(now.getTime() - maxAgeMs).toISOString(),
        ],
      );
      const row = rows[0];
      if (!row) return null;
      // Dernière activité du compte (durée de conservation des comptes
      // inactifs, fiche 0008) : notée au plus une fois par heure.
      await db.query(
        `UPDATE users SET last_seen_at = $2 WHERE id = $1
         AND (last_seen_at IS NULL OR last_seen_at < $3)`,
        [
          row.id,
          now.toISOString(),
          new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        ],
      );
      return toUser(row);
    },

    async deleteSession(tokenHash: string): Promise<void> {
      await db.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
    },

    async createOneTimeCode(input: {
      phone: string;
      codeHash: string;
      expiresAt: Date;
    }): Promise<void> {
      await db.query(
        "INSERT INTO one_time_codes (id, phone, code_hash, expires_at) VALUES ($1, $2, $3, $4)",
        [
          randomUUID(),
          input.phone,
          input.codeHash,
          input.expiresAt.toISOString(),
        ],
      );
    },

    async countCodesSince(phone: string, since: Date): Promise<number> {
      const { rows } = await db.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM one_time_codes WHERE phone = $1 AND created_at >= $2",
        [phone, since.toISOString()],
      );
      return rows[0]?.n ?? 0;
    },

    /** Dernier code envoyé à ce numéro, après avoir compté une tentative de plus. */
    async attemptLatestCode(phone: string): Promise<StoredOneTimeCode | null> {
      const { rows } = await db.query<{
        id: string;
        code_hash: string;
        expires_at: Date;
        attempts: number;
        consumed_at: Date | null;
      }>(
        `UPDATE one_time_codes SET attempts = attempts + 1
         WHERE id = (SELECT id FROM one_time_codes WHERE phone = $1 ORDER BY created_at DESC LIMIT 1)
         RETURNING id, code_hash, expires_at, attempts, consumed_at`,
        [phone],
      );
      const r = rows[0];
      return r
        ? {
            id: r.id,
            codeHash: r.code_hash,
            expiresAt: r.expires_at,
            attempts: r.attempts,
            consumedAt: r.consumed_at,
          }
        : null;
    },

    /** Faux si le code a déjà été consommé (deux vérifications simultanées). */
    async consumeCode(id: string, now: Date): Promise<boolean> {
      const { rows } = await db.query(
        "UPDATE one_time_codes SET consumed_at = $2 WHERE id = $1 AND consumed_at IS NULL RETURNING id",
        [id, now.toISOString()],
      );
      return rows.length > 0;
    },

    /** Appartenances de l'utilisateur, avec les permissions de chaque rôle. */
    async listMemberships(userId: UserId): Promise<Membership[]> {
      const { rows } = await db.query<{
        organization_id: string;
        kind: OrganizationKind;
        role_id: string;
        permissions: string[];
      }>(
        `SELECT m.organization_id, o.kind, m.role_id, r.permissions
         FROM memberships m
         JOIN organizations o ON o.id = m.organization_id
         JOIN roles r ON r.id = m.role_id
         WHERE m.user_id = $1
         ORDER BY o.created_at, r.name`,
        [userId],
      );
      return rows.map((r) => ({
        userId,
        organizationId: asOrganizationId(r.organization_id),
        organizationKind: r.kind,
        roleId: asRoleId(r.role_id),
        // Une permission retirée du catalogue reste en base mais n'a plus d'effet.
        permissions: r.permissions.filter(isPermission),
      }));
    },
  };
}

export type AccountStore = ReturnType<typeof createAccountStore>;
