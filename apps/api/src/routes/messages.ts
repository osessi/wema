import { zValidator } from "@hono/zod-validator";
import { type ContactLink, createMessageStore } from "@wema/db";
import { asUserId, type UserId } from "@wema/domain";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { fail, requireSession } from "../http";
import { createRateLimiter } from "../rate-limit";

const uuid = z.uuid();
const body = z.string().trim().min(1).max(4000);

/** Regroupe les liens d'une même personne (elle peut être liée par plusieurs classes). */
function groupContacts(links: ContactLink[]) {
  const byUser = new Map<
    UserId,
    {
      userId: UserId;
      displayName: string;
      links: {
        relation: ContactLink["relation"];
        className: string;
        childName: string | null;
      }[];
    }
  >();
  for (const l of links) {
    const entry = byUser.get(l.userId) ?? {
      userId: l.userId,
      displayName: l.displayName,
      links: [],
    };
    entry.links.push({
      relation: l.relation,
      className: l.className,
      childName: l.childName,
    });
    byUser.set(l.userId, entry);
  }
  return [...byUser.values()];
}

/**
 * Messagerie : fils à deux entre personnes qui ont un lien réel (prof ↔ élève
 * d'une de ses classes, prof ↔ parent d'un de ces élèves), et fil d'annonces
 * par classe, où seuls ses profs écrivent. Aucun appel d'IA ici.
 */
export function messageRoutes(deps: Deps) {
  const store = createMessageStore(deps.db);
  // Garde-fou contre l'envoi en rafale : 60 messages par personne et par 10 minutes.
  const limiter = createRateLimiter({
    max: 60,
    windowMs: 10 * 60 * 1000,
    now: deps.now,
  });

  return new Hono<Env>()
    .use(requireSession(deps))
    .get("/contacts", async (c) => {
      const userId = c.get("user").id;
      return c.json(
        {
          contacts: groupContacts(await store.contacts(userId)),
          classes: await store.teachingClasses(userId),
        },
        200,
      );
    })
    .get("/threads", async (c) => {
      const userId = c.get("user").id;
      const threads = await store.listThreads(userId);
      const contacts = new Set(
        (await store.contacts(userId)).map((l) => l.userId),
      );
      const teaching = new Set(
        (await store.teachingClasses(userId)).map((k) => k.id),
      );
      return c.json(
        {
          threads: threads.map((t) => ({
            ...t,
            canWrite:
              t.kind === "direct"
                ? t.otherId !== null && contacts.has(t.otherId)
                : t.classId !== null && teaching.has(t.classId),
          })),
          unreadTotal: threads.reduce((sum, t) => sum + t.unread, 0),
        },
        200,
      );
    })
    .get(
      "/threads/:id",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const userId = c.get("user").id;
        const thread = await store.access(c.req.valid("param").id, userId);
        if (!thread) return fail(c, 404, "not_found");
        const canWrite =
          thread.kind === "direct"
            ? thread.otherId !== null &&
              (await store.canWrite(userId, thread.otherId))
            : thread.classTeacher;
        const messages = await store.listMessages(thread.id);
        return c.json(
          {
            thread: { ...thread, canWrite },
            messages: messages.map((m) => ({
              ...m,
              mine: m.senderId === userId,
            })),
          },
          200,
        );
      },
    )
    .post(
      "/send",
      zValidator(
        "json",
        z.object({
          to: z.discriminatedUnion("kind", [
            z.object({ kind: z.literal("user"), userId: uuid }),
            z.object({ kind: z.literal("class"), classId: uuid }),
          ]),
          body,
        }),
      ),
      async (c) => {
        const userId = c.get("user").id;
        const input = c.req.valid("json");
        let threadId: string;
        if (input.to.kind === "user") {
          const to = asUserId(input.to.userId);
          if (!(await store.canWrite(userId, to)))
            return fail(c, 403, "forbidden");
          threadId = await store.directThread(userId, to);
        } else {
          const classId = input.to.classId;
          if (
            !(await store.teachingClasses(userId)).some((k) => k.id === classId)
          )
            return fail(c, 403, "forbidden");
          threadId = await store.classThread(classId);
        }
        if (!limiter.hit(userId)) return fail(c, 429, "too_many_messages");
        const message = await store.send({
          conversationId: threadId,
          senderId: userId,
          body: input.body,
        });
        return c.json({ threadId, message: { ...message, mine: true } }, 201);
      },
    )
    .post(
      "/threads/:id/messages",
      zValidator("param", z.object({ id: uuid })),
      zValidator("json", z.object({ body })),
      async (c) => {
        const userId = c.get("user").id;
        const thread = await store.access(c.req.valid("param").id, userId);
        if (!thread) return fail(c, 404, "not_found");
        // Les droits sont revérifiés à chaque envoi : un lien perdu (élève
        // sorti de la classe, parent délié) ferme l'écriture.
        const canWrite =
          thread.kind === "direct"
            ? thread.otherId !== null &&
              (await store.canWrite(userId, thread.otherId))
            : thread.classTeacher;
        if (!canWrite) return fail(c, 403, "forbidden");
        if (!limiter.hit(userId)) return fail(c, 429, "too_many_messages");
        const message = await store.send({
          conversationId: thread.id,
          senderId: userId,
          body: c.req.valid("json").body,
        });
        return c.json(
          { threadId: thread.id, message: { ...message, mine: true } },
          201,
        );
      },
    )
    .post(
      "/threads/:id/read",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const userId = c.get("user").id;
        const thread = await store.access(c.req.valid("param").id, userId);
        if (!thread) return fail(c, 404, "not_found");
        await store.markRead(thread.id, userId);
        return c.json({ ok: true }, 200);
      },
    );
}
