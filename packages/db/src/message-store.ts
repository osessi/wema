import { randomUUID } from "node:crypto";
import type { UserId } from "@wema/domain";
import { asUserId } from "@wema/domain";
import type { SqlExecutor } from "./executor";

/**
 * Lien qui autorise deux personnes à s'écrire :
 * - `learner` : la personne est élève d'une de mes classes ;
 * - `guardian` : elle est parent d'un élève d'une de mes classes ;
 * - `teacher` : elle est prof d'une de mes classes, ou d'une classe de mon enfant.
 */
export type ContactRelation = "learner" | "guardian" | "teacher";

export interface ContactLink {
  userId: UserId;
  displayName: string;
  relation: ContactRelation;
  className: string;
  /** Enfant par qui passe le lien (prof ↔ parent), sinon `null`. */
  childName: string | null;
}

export interface ThreadSummary {
  id: string;
  kind: "direct" | "class";
  classId: string | null;
  className: string | null;
  /** Autre participant d'un fil direct. */
  otherId: UserId | null;
  otherName: string | null;
  lastMessage: {
    body: string;
    senderId: UserId | null;
    createdAt: Date;
  } | null;
  unread: number;
}

export interface ThreadAccess {
  id: string;
  kind: "direct" | "class";
  classId: string | null;
  className: string | null;
  otherId: UserId | null;
  otherName: string | null;
  /** Prof de la classe (fil d'annonces) : lui seul y écrit. */
  classTeacher: boolean;
}

export interface Message {
  id: string;
  senderId: UserId | null;
  senderName: string | null;
  body: string;
  createdAt: Date;
}

/** Appartenance encore valable à une classe active (cf. class-store). */
export const ACTIVE_MEMBERS = `SELECT m.class_id, m.user_id, m.role, c.name AS class_name
  FROM class_members m JOIN classes c ON c.id = m.class_id
  WHERE c.archived_at IS NULL
    AND EXISTS (SELECT 1 FROM memberships o WHERE o.organization_id = c.organization_id AND o.user_id = m.user_id)`;

/** Lien parent ↔ enfant encore valable (les deux sont membres de la famille). */
export const VALID_GUARDIANSHIPS = `SELECT g.guardian_id, g.learner_id FROM guardianships g
  WHERE EXISTS (SELECT 1 FROM memberships o WHERE o.organization_id = g.organization_id AND o.user_id = g.guardian_id)
    AND EXISTS (SELECT 1 FROM memberships o WHERE o.organization_id = g.organization_id AND o.user_id = g.learner_id)`;

const directKey = (a: UserId, b: UserId) => [a, b].sort().join(":");

export function createMessageStore(db: SqlExecutor) {
  const store = {
    /** Toutes les personnes à qui l'utilisateur peut écrire, avec le lien qui le permet. */
    async contacts(userId: UserId): Promise<ContactLink[]> {
      const { rows } = await db.query<{
        user_id: string;
        display_name: string;
        relation: ContactRelation;
        class_name: string;
        child_name: string | null;
      }>(
        `WITH am AS (${ACTIVE_MEMBERS}), vg AS (${VALID_GUARDIANSHIPS}),
         links AS (
           -- Prof → élèves de ses classes.
           SELECT l.user_id, 'learner' AS relation, me.class_name, NULL::uuid AS child_id
           FROM am me JOIN am l ON l.class_id = me.class_id AND l.role = 'learner'
           WHERE me.user_id = $1 AND me.role = 'teacher'
           UNION
           -- Prof → parents des élèves de ses classes.
           SELECT g.guardian_id, 'guardian', me.class_name, l.user_id
           FROM am me JOIN am l ON l.class_id = me.class_id AND l.role = 'learner'
           JOIN vg g ON g.learner_id = l.user_id
           WHERE me.user_id = $1 AND me.role = 'teacher'
           UNION
           -- Élève → profs de ses classes.
           SELECT t.user_id, 'teacher', me.class_name, NULL::uuid
           FROM am me JOIN am t ON t.class_id = me.class_id AND t.role = 'teacher'
           WHERE me.user_id = $1 AND me.role = 'learner'
           UNION
           -- Parent → profs des classes de ses enfants.
           SELECT t.user_id, 'teacher', l.class_name, l.user_id
           FROM vg g JOIN am l ON l.user_id = g.learner_id AND l.role = 'learner'
           JOIN am t ON t.class_id = l.class_id AND t.role = 'teacher'
           WHERE g.guardian_id = $1
         )
         SELECT k.user_id, u.display_name, k.relation, k.class_name, ch.display_name AS child_name
         FROM links k JOIN users u ON u.id = k.user_id
         LEFT JOIN users ch ON ch.id = k.child_id
         WHERE k.user_id <> $1
         ORDER BY u.display_name, k.class_name`,
        [userId],
      );
      return rows.map((r) => ({
        userId: asUserId(r.user_id),
        displayName: r.display_name,
        relation: r.relation,
        className: r.class_name,
        childName: r.child_name,
      }));
    },

    /** Vrai si l'utilisateur peut écrire à cette personne (lien réel et actuel). */
    async canWrite(from: UserId, to: UserId): Promise<boolean> {
      if (from === to) return false;
      return (await store.contacts(from)).some((c) => c.userId === to);
    },

    /** Classes actives où l'utilisateur est prof : il peut y faire des annonces. */
    async teachingClasses(
      userId: UserId,
    ): Promise<{ id: string; name: string }[]> {
      const { rows } = await db.query<{ class_id: string; class_name: string }>(
        `SELECT am.class_id, am.class_name FROM (${ACTIVE_MEMBERS}) am
         WHERE am.user_id = $1 AND am.role = 'teacher' ORDER BY am.class_name`,
        [userId],
      );
      return rows.map((r) => ({ id: r.class_id, name: r.class_name }));
    },

    /** Fil direct entre deux personnes, créé au besoin (un seul par paire). */
    async directThread(a: UserId, b: UserId): Promise<string> {
      const key = directKey(a, b);
      return db.transaction(async (tx) => {
        const { rows } = await tx.query<{ id: string }>(
          `INSERT INTO conversations (id, kind, direct_key) VALUES ($1, 'direct', $2)
           ON CONFLICT (direct_key) DO UPDATE SET direct_key = EXCLUDED.direct_key RETURNING id`,
          [randomUUID(), key],
        );
        const id = rows[0]?.id;
        if (!id) throw new Error("fil direct sans identifiant");
        await tx.query(
          `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)
           ON CONFLICT DO NOTHING`,
          [id, a, b],
        );
        return id;
      });
    },

    /** Fil d'annonces d'une classe, créé au besoin. */
    async classThread(classId: string): Promise<string> {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO conversations (id, kind, class_id) VALUES ($1, 'class', $2)
         ON CONFLICT (class_id) DO UPDATE SET class_id = EXCLUDED.class_id RETURNING id`,
        [randomUUID(), classId],
      );
      const id = rows[0]?.id;
      if (!id) throw new Error("fil de classe sans identifiant");
      return id;
    },

    /**
     * Fil vu par l'utilisateur, ou `null` s'il n'y a pas accès : participant
     * d'un fil direct, ou membre actuel de la classe d'un fil d'annonces.
     */
    async access(
      conversationId: string,
      userId: UserId,
    ): Promise<ThreadAccess | null> {
      const { rows } = await db.query<{
        id: string;
        kind: "direct" | "class";
        class_id: string | null;
        class_name: string | null;
        other_id: string | null;
        other_name: string | null;
        participant: boolean;
        class_role: "learner" | "teacher" | null;
      }>(
        `SELECT cv.id, cv.kind, cv.class_id, c.name AS class_name,
           o.user_id AS other_id, ou.display_name AS other_name,
           EXISTS (SELECT 1 FROM conversation_participants p WHERE p.conversation_id = cv.id AND p.user_id = $2) AS participant,
           (SELECT am.role FROM (${ACTIVE_MEMBERS}) am WHERE am.class_id = cv.class_id AND am.user_id = $2) AS class_role
         FROM conversations cv
         LEFT JOIN classes c ON c.id = cv.class_id
         LEFT JOIN conversation_participants o ON o.conversation_id = cv.id AND cv.kind = 'direct' AND o.user_id <> $2
         LEFT JOIN users ou ON ou.id = o.user_id
         WHERE cv.id = $1`,
        [conversationId, userId],
      );
      const r = rows[0];
      if (!r) return null;
      if (r.kind === "direct" ? !r.participant : r.class_role === null)
        return null;
      return {
        id: r.id,
        kind: r.kind,
        classId: r.class_id,
        className: r.class_name,
        otherId: r.other_id === null ? null : asUserId(r.other_id),
        otherName: r.other_name,
        classTeacher: r.class_role === "teacher",
      };
    },

    /** Fils de l'utilisateur qui ont au moins un message, du plus récent au plus ancien. */
    async listThreads(userId: UserId): Promise<ThreadSummary[]> {
      const { rows } = await db.query<{
        id: string;
        kind: "direct" | "class";
        class_id: string | null;
        class_name: string | null;
        other_id: string | null;
        other_name: string | null;
        last_body: string | null;
        last_sender_id: string | null;
        last_at: Date | null;
        unread: number;
      }>(
        `WITH mine AS (
           SELECT p.conversation_id AS id FROM conversation_participants p WHERE p.user_id = $1
           UNION
           SELECT cv.id FROM conversations cv JOIN (${ACTIVE_MEMBERS}) am ON am.class_id = cv.class_id AND am.user_id = $1
         )
         SELECT cv.id, cv.kind, cv.class_id, c.name AS class_name,
           o.user_id AS other_id, ou.display_name AS other_name,
           lm.body AS last_body, lm.sender_id AS last_sender_id, lm.created_at AS last_at,
           (SELECT count(*)::int FROM messages x WHERE x.conversation_id = cv.id
              AND x.sender_id IS DISTINCT FROM $1
              AND x.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)) AS unread
         FROM conversations cv JOIN mine ON mine.id = cv.id
         LEFT JOIN classes c ON c.id = cv.class_id
         LEFT JOIN conversation_participants o ON o.conversation_id = cv.id AND cv.kind = 'direct' AND o.user_id <> $1
         LEFT JOIN users ou ON ou.id = o.user_id
         LEFT JOIN conversation_reads r ON r.conversation_id = cv.id AND r.user_id = $1
         LEFT JOIN LATERAL (
           SELECT m.body, m.sender_id, m.created_at FROM messages m WHERE m.conversation_id = cv.id
           ORDER BY m.created_at DESC, m.id DESC LIMIT 1
         ) lm ON true
         WHERE cv.last_message_at IS NOT NULL
         ORDER BY cv.last_message_at DESC`,
        [userId],
      );
      return rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        classId: r.class_id,
        className: r.class_name,
        otherId: r.other_id === null ? null : asUserId(r.other_id),
        otherName: r.other_name,
        lastMessage:
          r.last_body === null || r.last_at === null
            ? null
            : {
                body: r.last_body,
                senderId:
                  r.last_sender_id === null ? null : asUserId(r.last_sender_id),
                createdAt: r.last_at,
              },
        unread: r.unread,
      }));
    },

    /** Derniers messages d'un fil, du plus ancien au plus récent. */
    async listMessages(
      conversationId: string,
      limit = 200,
    ): Promise<Message[]> {
      const { rows } = await db.query<{
        id: string;
        sender_id: string | null;
        sender_name: string | null;
        body: string;
        created_at: Date;
      }>(
        `SELECT * FROM (
           SELECT m.id, m.sender_id, u.display_name AS sender_name, m.body, m.created_at
           FROM messages m LEFT JOIN users u ON u.id = m.sender_id
           WHERE m.conversation_id = $1 ORDER BY m.created_at DESC, m.id DESC LIMIT $2
         ) last ORDER BY created_at, id`,
        [conversationId, limit],
      );
      return rows.map((r) => ({
        id: r.id,
        senderId: r.sender_id === null ? null : asUserId(r.sender_id),
        senderName: r.sender_name,
        body: r.body,
        createdAt: r.created_at,
      }));
    },

    /** Ajoute un message ; le fil est aussitôt lu pour son auteur. */
    async send(input: {
      conversationId: string;
      senderId: UserId;
      body: string;
    }): Promise<Message> {
      return db.transaction(async (tx) => {
        const { rows } = await tx.query<{ id: string; created_at: Date }>(
          `INSERT INTO messages (id, conversation_id, sender_id, body) VALUES ($1, $2, $3, $4)
           RETURNING id, created_at`,
          [randomUUID(), input.conversationId, input.senderId, input.body],
        );
        const row = rows[0];
        if (!row) throw new Error("message sans retour");
        await tx.query(
          "UPDATE conversations SET last_message_at = $2 WHERE id = $1",
          [input.conversationId, row.created_at],
        );
        await tx.query(
          `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at) VALUES ($1, $2, $3)
           ON CONFLICT (conversation_id, user_id) DO UPDATE
             SET last_read_at = greatest(conversation_reads.last_read_at, EXCLUDED.last_read_at)`,
          [input.conversationId, input.senderId, row.created_at],
        );
        const { rows: names } = await tx.query<{ display_name: string }>(
          "SELECT display_name FROM users WHERE id = $1",
          [input.senderId],
        );
        return {
          id: row.id,
          senderId: input.senderId,
          senderName: names[0]?.display_name ?? null,
          body: input.body,
          createdAt: row.created_at,
        };
      });
    },

    /** Marque comme lu tout ce que le fil contient à cet instant. */
    async markRead(conversationId: string, userId: UserId): Promise<void> {
      await db.query(
        `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
         SELECT $1, $2, max(m.created_at) FROM messages m WHERE m.conversation_id = $1 HAVING count(*) > 0
         ON CONFLICT (conversation_id, user_id) DO UPDATE
           SET last_read_at = greatest(conversation_reads.last_read_at, EXCLUDED.last_read_at)`,
        [conversationId, userId],
      );
    },
  };
  return store;
}

export type MessageStore = ReturnType<typeof createMessageStore>;
