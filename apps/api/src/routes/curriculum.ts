import { zValidator } from "@hono/zod-validator";
import { assembleCurriculum, checkPrerequisiteChange } from "@wema/curriculum";
import {
  type CurriculumStore,
  type CurriculumWriteError,
  createAuditLog,
  createCurriculumStore,
  createOrganizationStore,
  createTutorStore,
  type SqlExecutor,
} from "@wema/db";
import {
  asCountryId,
  asGradeId,
  asMisconceptionId,
  asNotionId,
  asProgramId,
  asSubjectId,
  asUnitId,
  err,
  type OrganizationId,
  type Result,
  SUBJECT_ICONS,
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
/** Icône d'une matière : une clé de la liste fermée, ou aucune. */
const subjectIcon = z.enum(SUBJECT_ICONS).nullable();

const statusOf = (e: CurriculumWriteError) =>
  e.kind === "not_found" ? 404 : e.kind === "duplicate" ? 409 : 422;

export function curriculumRoutes(deps: Deps) {
  const store = createCurriculumStore(deps.db);

  // Les modifications du référentiel concernent toute la plateforme : elles
  // sont tracées dans le journal de l'organisation Wema.
  let platformId: OrganizationId | null = null;
  const platform = async () => {
    platformId ??=
      (await createOrganizationStore(deps.db).getPlatformOrganization())?.id ??
      null;
    return platformId;
  };

  /**
   * Exécute l'écriture et sa trace dans une même transaction, puis répond
   * avec l'identifiant écrit, ou l'erreur.
   */
  const respond = async <T extends { id: string } | string>(
    c: Context<Env>,
    run: (
      s: CurriculumStore,
      tx: SqlExecutor,
    ) => Promise<Result<T, CurriculumWriteError>>,
    action: string,
    details: Record<string, unknown>,
  ) => {
    const organizationId = await platform();
    const result = await deps.db.transaction(async (tx) => {
      const written = await run(createCurriculumStore(tx), tx);
      if (written.ok) {
        const value = written.value;
        await createAuditLog(tx).append({
          actorId: c.get("user").id,
          organizationId,
          action,
          targetType: action.split(".")[0] ?? action,
          targetId: typeof value === "string" ? value : value.id,
          details,
        });
      }
      return written;
    });
    if (!result.ok)
      return fail(c, statusOf(result.error), result.error.kind, result.error);
    const value = result.value;
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
        return respond(c, (s) => s.createCountry(body), "country.create", body);
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
          (s) => s.updateCountry(id, body),
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
          (s) => s.createGrade({ countryId, ...body }),
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
          (s) => s.updateGrade(asGradeId(c.req.valid("param").id), body),
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
      zValidator(
        "json",
        z.object({ code: slug, name, icon: subjectIcon.optional() }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        return respond(c, (s) => s.createSubject(body), "subject.create", body);
      },
    )
    .patch(
      "/subjects/:id",
      write,
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "json",
        z.object({
          name,
          icon: subjectIcon.optional(),
          archived: z.boolean().optional(),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        return respond(
          c,
          (s) => s.updateSubject(asSubjectId(c.req.valid("param").id), body),
          "subject.update",
          body,
        );
      },
    )
    .get(
      "/subjects/:id/tutor",
      read,
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const instructions = await createTutorStore(
          deps.db,
        ).getTutorInstructions(asSubjectId(c.req.valid("param").id));
        return c.json({ instructions }, 200);
      },
    )
    .put(
      "/subjects/:id/tutor",
      write,
      zValidator("param", z.object({ id: uuid })),
      zValidator("json", z.object({ instructions: z.string().max(4000) })),
      async (c) => {
        // Consignes propres au prof IA de cette matière (jamais figées dans le code).
        const id = asSubjectId(c.req.valid("param").id);
        const { instructions } = c.req.valid("json");
        const organizationId = await platform();
        const updated = await deps.db.transaction(async (tx) => {
          const found = await createTutorStore(tx).setTutorInstructions(
            id,
            instructions,
          );
          if (found) {
            await createAuditLog(tx).append({
              actorId: c.get("user").id,
              organizationId,
              action: "subject.tutor_instructions",
              targetType: "subject",
              targetId: id,
              details: { length: instructions.length },
            });
          }
          return found;
        });
        if (!updated) return fail(c, 404, "not_found");
        return c.json({ ok: true, id });
      },
    )
    .post(
      "/programs",
      write,
      zValidator("json", z.object({ gradeId: uuid, subjectId: uuid })),
      async (c) => {
        const body = c.req.valid("json");
        const result = (s: CurriculumStore) =>
          s.createProgram({
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
        const result = (s: CurriculumStore) =>
          s.archiveProgram(asProgramId(c.req.valid("param").id), body.archived);
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
          (s) =>
            s.createUnit({
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
          (s) => s.updateUnit(asUnitId(c.req.valid("param").id), body),
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
          (s) => s.createNotion({ ...body, unitId: asUnitId(body.unitId) }),
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
          (s) =>
            s.updateNotion(id, {
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
        if (!countryId) return fail(c, 404, "not_found");
        let rejection: unknown = null;
        const response = await respond(
          c,
          async (s, tx) => {
            // Deux modifications simultanées (A→B et B→A) créeraient une boucle :
            // le contrôle et l'écriture se font sous un verrou propre au pays.
            await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
              `prerequisites:${countryId}`,
            ]);
            const rows = await s.loadCountry(countryId);
            const curriculum = rows ? assembleCurriculum(rows) : null;
            const checked = curriculum?.ok
              ? checkPrerequisiteChange(curriculum.value, id, prerequisites)
              : null;
            if (!checked?.ok) {
              rejection = checked
                ? checked.error
                : curriculum && !curriculum.ok
                  ? curriculum.error
                  : null;
              return err({
                kind: "invalid_reference",
                constraint: "prerequisites",
              });
            }
            return s.setPrerequisites(id, prerequisites);
          },
          "notion.prerequisites",
          { prerequisites },
        );
        if (rejection !== null)
          return fail(c, 422, "invalid_prerequisites", rejection);
        return response;
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
          (s) => s.createMisconception({ notionId, ...body }),
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
          (s) => s.updateMisconception(id, body),
          "misconception.update",
          body,
        );
      },
    );
}
