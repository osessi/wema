import { zValidator } from "@hono/zod-validator";
import { createCurriculumStore, createTutorPersonaStore } from "@wema/db";
import {
  asLearnerId,
  asNotionId,
  isSafeTutorName,
  isTutorAvatar,
  normalizeTutorName,
  resolveTutorPersona,
  TUTOR_AVATARS,
} from "@wema/domain";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { fail, requireSession } from "../http";
import { notionInfo } from "../tutor-context";

const personaBody = z.object({
  /** Nul : pour toutes les matières. */
  subjectId: z.uuid().nullable().default(null),
  name: z.string().max(60),
  avatar: z.string().refine(isTutorAvatar, { message: "avatar inconnu" }),
});

/** Prénom et avatar du prof IA, choisis par l'élève pour lui-même. */
export function tutorPersonaRoutes(deps: Deps) {
  const personas = createTutorPersonaStore(deps.db);
  return new Hono<Env>()
    .use(requireSession(deps))
    .get(
      "/",
      zValidator("query", z.object({ notionId: z.uuid().optional() })),
      async (c) => {
        const learnerId = asLearnerId(c.get("user").id);
        const { notionId } = c.req.valid("query");
        const list = await personas.list(learnerId);
        // La matière d'une séance : son réglage passe avant celui de toutes les matières.
        const subjectId = notionId
          ? ((await notionInfo(deps.db, asNotionId(notionId)))?.subject.id ??
            null)
          : null;
        const subjects = (await createCurriculumStore(deps.db).listSubjects())
          .filter((s) => !s.archived)
          .map((s) => ({ id: s.id, name: s.name, icon: s.icon }));
        return c.json(
          {
            avatars: TUTOR_AVATARS,
            personas: list,
            current: resolveTutorPersona(list, subjectId),
            subjects,
          },
          200,
        );
      },
    )
    .put("/", zValidator("json", personaBody), async (c) => {
      const body = c.req.valid("json");
      const name = normalizeTutorName(body.name);
      if (!isSafeTutorName(name)) return fail(c, 422, "invalid_tutor_name");
      if (!isTutorAvatar(body.avatar)) return fail(c, 422, "invalid_avatar");
      if (
        body.subjectId &&
        !(await createCurriculumStore(deps.db).listSubjects()).some(
          (s) => s.id === body.subjectId && !s.archived,
        )
      )
        return fail(c, 404, "not_found");
      const persona = {
        subjectId: body.subjectId,
        name,
        avatar: body.avatar,
      };
      await personas.set(asLearnerId(c.get("user").id), persona);
      return c.json({ ok: true, persona }, 200);
    });
}
