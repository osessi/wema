import { zValidator } from "@hono/zod-validator";
import { assembleCurriculum, checkPrerequisiteChange } from "@wema/curriculum";
import {
  type CurriculumWriteError,
  createAuditLog,
  createCurriculumStore,
  createOrganizationStore,
} from "@wema/db";
import {
  asCountryId,
  asGradeId,
  asMisconceptionId,
  asNotionId,
  asProgramId,
  asSubjectId,
  asUnitId,
  type OrganizationId,
  type Result,
} from "@wema/domain";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { fail, requirePermission, requireSession } from "../http";

const name = z.string().trim().min(1).max(200);
const description = z.string().trim().max(4000);
const position = z.number().int().min(0).max(100_000);
/** Code lisible : minuscules, chiffres et tirets (ex. pythagore). */
const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const uuid = z.uuid();
const unitLabel = z.object({ singular: name, plural: name });

const statusOf = (e: CurriculumWriteError) =>
  e.kind === "not_found" ? 404 : e.kind === "duplicate" ? 409 : 422;

export function curriculumRoutes(deps: Deps) {
  const store = createCurriculumStore(deps.db);
  const audit = createAuditLog(deps.db);

  // Les modifications du référentiel concernent toute la plateforme : elles
  // sont tracées dans le journal de l'organisation Wema.
  let platformId: OrganizationId | null = null;
  const platform = async () => {
    platformId ??=
      (await createOrganizationStore(deps.db).getPlatformOrganization())?.id ??
      null;
    return platformId;
  };

  /** Répond avec la ligne écrite, ou l'erreur ; trace l'écriture réussie. */
  const respond = async <T extends { id: string } | string>(
    c: Context<Env>,
    result: Result<T, CurriculumWriteError>,
    action: string,
    details: Record<string, unknown>,
  ) => {
    if (!result.ok)
      return fail(c, statusOf(result.error), result.error.kind, result.error);
    const value = result.value;
    await audit.append({
      actorId: c.get("user").id,
      organizationId: await platform(),
      action,
      targetType: action.split(".")[0] ?? action,
      targetId: typeof value === "string" ? value : value.id,
      details,
    });
    return c.json({
      ok: true,
      id: typeof value === "string" ? value : value.id,
    });
  };

  const read = requirePermission("curriculum.read");
  const write = requirePermission("curriculum.write");

  return new Hono<Env>()
    .use(requireSession(deps))
    .get("/countries", read, async (c) =>
      c.json({ countries: await store.listCountries() }, 200),
    )
    .post(
      "/countries",
      write,
      zValidator(
        "json",
        z.object({
          code: z
            .string()
            .trim()
            .regex(/^[A-Za-z]{2,3}$/),
          name,
          unitLabel,
        }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        return respond(
          c,
          await store.createCountry(body),
          "country.create",
          body,
        );
      },
    )
    .patch(
      "/countries/:id",
      write,
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "json",
        z.object({ name, unitLabel, archived: z.boolean().optional() }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        const id = asCountryId(c.req.valid("param").id);
        return respond(
          c,
          await store.updateCountry(id, body),
          "country.update",
          body,
        );
      },
    )
    .get(
      "/countries/:id/curriculum",
      read,
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const curriculum = await store.loadCountry(
          asCountryId(c.req.valid("param").id),
        );
        if (!curriculum) return fail(c, 404, "not_found");
        return c.json(curriculum, 200);
      },
    )
    .post(
      "/countries/:id/grades",
      write,
      zValidator("param", z.object({ id: uuid })),
      zValidator("json", z.object({ name, position })),
      async (c) => {
        const body = c.req.valid("json");
        const countryId = asCountryId(c.req.valid("param").id);
        return respond(
          c,
          await store.createGrade({ countryId, ...body }),
          "grade.create",
          { countryId, ...body },
        );
      },
    )
    .patch(
      "/grades/:id",
      write,
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "json",
        z.object({ name, position, archived: z.boolean().optional() }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        return respond(
          c,
          await store.updateGrade(asGradeId(c.req.valid("param").id), body),
          "grade.update",
          body,
        );
      },
    )
    .get("/subjects", read, async (c) =>
      c.json({ subjects: await store.listSubjects() }, 200),
    )
    .post(
      "/subjects",
      write,
      zValidator("json", z.object({ code: slug, name })),
      async (c) => {
        const body = c.req.valid("json");
        return respond(
          c,
          await store.createSubject(body),
          "subject.create",
          body,
        );
      },
    )
    .patch(
      "/subjects/:id",
      write,
      zValidator("param", z.object({ id: uuid })),
      zValidator("json", z.object({ name, archived: z.boolean().optional() })),
      async (c) => {
        const body = c.req.valid("json");
        return respond(
          c,
          await store.updateSubject(asSubjectId(c.req.valid("param").id), body),
          "subject.update",
          body,
        );
      },
    )
    .post(
      "/programs",
      write,
      zValidator("json", z.object({ gradeId: uuid, subjectId: uuid })),
      async (c) => {
        const body = c.req.valid("json");
        const result = await store.createProgram({
          gradeId: asGradeId(body.gradeId),
          subjectId: asSubjectId(body.subjectId),
        });
        return respond(c, result, "program.create", body);
      },
    )
    .patch(
      "/programs/:id",
      write,
      zValidator("param", z.object({ id: uuid })),
      zValidator("json", z.object({ archived: z.boolean() })),
      async (c) => {
        const body = c.req.valid("json");
        const result = await store.archiveProgram(
          asProgramId(c.req.valid("param").id),
          body.archived,
        );
        return respond(c, result, "program.update", body);
      },
    )
    .post(
      "/units",
      write,
      zValidator(
        "json",
        z.object({ programId: uuid, name, description, position }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        return respond(
          c,
          await store.createUnit({
            ...body,
            programId: asProgramId(body.programId),
          }),
          "unit.create",
          body,
        );
      },
    )
    .patch(
      "/units/:id",
      write,
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "json",
        z.object({
          name,
          description,
          position,
          archived: z.boolean().optional(),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        return respond(
          c,
          await store.updateUnit(asUnitId(c.req.valid("param").id), body),
          "unit.update",
          body,
        );
      },
    )
    .post(
      "/notions",
      write,
      zValidator(
        "json",
        z.object({
          unitId: uuid,
          code: slug,
          name,
          description: description.min(1),
          position,
        }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        return respond(
          c,
          await store.createNotion({ ...body, unitId: asUnitId(body.unitId) }),
          "notion.create",
          body,
        );
      },
    )
    .patch(
      "/notions/:id",
      write,
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "json",
        z.object({
          unitId: uuid,
          code: slug,
          name,
          description: description.min(1),
          position,
          verified: z.boolean(),
          archived: z.boolean().optional(),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        const id = asNotionId(c.req.valid("param").id);
        return respond(
          c,
          await store.updateNotion(id, {
            ...body,
            unitId: asUnitId(body.unitId),
          }),
          "notion.update",
          body,
        );
      },
    )
    .put(
      "/notions/:id/prerequisites",
      write,
      zValidator("param", z.object({ id: uuid })),
      zValidator("json", z.object({ prerequisites: z.array(uuid).max(50) })),
      async (c) => {
        const id = asNotionId(c.req.valid("param").id);
        const prerequisites = c.req.valid("json").prerequisites.map(asNotionId);
        const countryId = await store.countryOfNotion(id);
        const rows = countryId ? await store.loadCountry(countryId) : null;
        if (!rows) return fail(c, 404, "not_found");
        const curriculum = assembleCurriculum(rows);
        if (!curriculum.ok)
          return fail(c, 500, "invalid_curriculum", curriculum.error);
        const checked = checkPrerequisiteChange(
          curriculum.value,
          id,
          prerequisites,
        );
        if (!checked.ok)
          return fail(c, 422, "invalid_prerequisites", checked.error);
        return respond(
          c,
          await store.setPrerequisites(id, prerequisites),
          "notion.prerequisites",
          { prerequisites },
        );
      },
    )
    .post(
      "/notions/:id/misconceptions",
      write,
      zValidator("param", z.object({ id: uuid })),
      zValidator("json", z.object({ description: description.min(1) })),
      async (c) => {
        const notionId = asNotionId(c.req.valid("param").id);
        const body = c.req.valid("json");
        return respond(
          c,
          await store.createMisconception({ notionId, ...body }),
          "misconception.create",
          { notionId, ...body },
        );
      },
    )
    .patch(
      "/misconceptions/:id",
      write,
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "json",
        z.object({
          description: description.min(1),
          archived: z.boolean().optional(),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        const id = asMisconceptionId(c.req.valid("param").id);
        return respond(
          c,
          await store.updateMisconception(id, body),
          "misconception.update",
          body,
        );
      },
    );
}
