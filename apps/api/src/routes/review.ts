import { zValidator } from "@hono/zod-validator";
import {
  type AdminCounts,
  createCurriculumStore,
  createOrganizationStore,
  createReviewStore,
} from "@wema/db";
import { asCountryId, type OrganizationId } from "@wema/domain";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { allowed, requirePermission, requireSession } from "../http";

/**
 * Compteurs du menu, limités à ce que la personne peut traiter : null pour ce
 * qu'elle ne voit pas (le menu n'affiche alors pas de pastille).
 */
export function visibleCounts(
  counts: AdminCounts,
  can: { curriculum: boolean; exercises: boolean; contacts: boolean },
): { toReview: number | null; contacts: number | null } {
  const notions = can.curriculum ? counts.notions : 0;
  const exercises = can.exercises ? counts.exercises : 0;
  return {
    toReview: can.curriculum || can.exercises ? notions + exercises : null,
    contacts: can.contacts ? counts.contacts : null,
  };
}

/**
 * Écran « À valider » du back-office : notions non vérifiées et exercices de
 * la bibliothèque Wema en brouillon, tous pays confondus. La validation
 * elle-même passe par les routes existantes (notion, exercice).
 */
export function reviewRoutes(deps: Deps) {
  const review = createReviewStore(deps.db);
  let library: OrganizationId | null = null;
  const platform = async () => {
    library ??=
      (await createOrganizationStore(deps.db).getPlatformOrganization())?.id ??
      null;
    return library;
  };

  return new Hono<Env>()
    .use(requireSession(deps))
    .get("/counts", async (c) => {
      const lib = await platform();
      const can = {
        curriculum: allowed(c, "curriculum.write"),
        exercises: lib !== null && allowed(c, "exercises.write", lib),
        contacts: allowed(c, "contacts.manage"),
      };
      if (!can.curriculum && !can.exercises && !can.contacts)
        return c.json({ toReview: null, contacts: null }, 200);
      return c.json(visibleCounts(await review.counts(lib), can), 200);
    })
    .get(
      "/",
      requirePermission("curriculum.write"),
      zValidator("query", z.object({ countryId: z.uuid().optional() })),
      async (c) => {
        const { countryId } = c.req.valid("query");
        const filter = countryId ? { countryId: asCountryId(countryId) } : {};
        const lib = await platform();
        const canExercises = lib !== null && allowed(c, "exercises.write", lib);
        const [notions, exercises, counts, countries] = await Promise.all([
          review.pendingNotions(filter),
          lib && canExercises ? review.pendingExercises(lib, filter) : [],
          review.counts(lib, filter),
          createCurriculumStore(deps.db).listCountries(),
        ]);
        return c.json(
          {
            notions: notions.map((n) => ({
              ...n,
              createdAt: n.createdAt.toISOString(),
            })),
            exercises: exercises.map((e) => ({
              ...e,
              createdAt: e.createdAt.toISOString(),
            })),
            total: {
              notions: counts.notions,
              exercises: canExercises ? counts.exercises : 0,
            },
            countries: countries
              .filter((k) => !k.archived)
              .map((k) => ({ id: k.id, name: k.name })),
          },
          200,
        );
      },
    );
}
