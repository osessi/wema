import { zValidator } from "@hono/zod-validator";
import {
  createExerciseStore,
  createHealthStore,
  createRenderingStore,
} from "@wema/db";
import {
  asExerciseVariantId,
  asLearnerId,
  type CanonicalAnswer,
  type ExerciseTask,
  type ExerciseVariantId,
  isSafeInterestLabel,
  type LearnerId,
  type PresentationFormat,
  type RenderedMath,
} from "@wema/domain";
import {
  adaptToComics,
  adaptToEasyReading,
  type ComicsContent,
  choosePresentation,
  comicsSchema,
  type EasyReadingContent,
  easyReadingSchema,
  figureFor,
  MANIPULABLE_FIGURES,
  measureFormats,
  splitSentences,
} from "@wema/exercises";
import { projectHypotheses } from "@wema/learner-model";
import { Hono } from "hono";
import { z } from "zod";
import { accessGuard, subscriptionRequired } from "../billing/access";
import type { Deps, Env } from "../context";
import { fail, requireSession } from "../http";
import { createRateLimiter } from "../rate-limit";
import { learnerModel } from "./exercises";

// Formats adaptés (architecture §2.4) : l'API assemble, le cœur décide
// (@wema/exercises : choosePresentation, figureFor, adaptToComics…).

const renderable = z.enum(["comics", "easy_reading"]);
type Renderable = z.infer<typeof renderable>;

/** Ce qu'il faut d'une variante pour la présenter dans un format. */
interface Presentable {
  statement: string;
  rendered: Readonly<Record<string, RenderedMath>>;
  answer: CanonicalAnswer;
  parameters: Readonly<Record<string, number>>;
}

/** Résultat d'un rendu : le contenu reformulé, ou le repli sur le texte vérifié. */
export interface RenderOutcome {
  format: Renderable;
  status: "ok" | "fallback";
  comics: ComicsContent | null;
  easyReading: EasyReadingContent | null;
}

const fallback = (format: Renderable, v: Presentable): RenderOutcome => ({
  format,
  status: "fallback",
  comics: null,
  // Lecture facile sans IA : l'énoncé vérifié découpé en phrases.
  easyReading: format === "easy_reading" ? splitSentences(v.statement) : null,
});

/** Contenu reformulé (relu par le schéma de son format) ; null s'il est illisible. */
function outcomeOf(format: Renderable, content: unknown): RenderOutcome | null {
  if (format === "comics") {
    const parsed = comicsSchema.safeParse(content);
    return parsed.success
      ? { format, status: "ok", comics: parsed.data, easyReading: null }
      : null;
  }
  const parsed = easyReadingSchema.safeParse(content);
  return parsed.success
    ? { format, status: "ok", comics: null, easyReading: parsed.data }
    : null;
}

/** Figure et manipulable proposés pour une variante (null : pas de gabarit). */
export function figureOf(task: ExerciseTask, v: Presentable) {
  const figure = figureFor(task, v.parameters);
  return {
    figure,
    manipulable:
      figure && MANIPULABLE_FIGURES.includes(figure.kind) ? figure.kind : null,
  };
}

/**
 * Reformule une variante par l'IA (BD ou lecture facile), avec contrôle des
 * nombres. Sans cache (aperçu du prof) si `variantId` est null.
 */
export async function renderFormat(
  deps: Deps,
  input: {
    format: Renderable;
    variant: Presentable;
    variantId: ExerciseVariantId | null;
    learnerId: LearnerId | null;
    organizationId: string | null;
    interests?: readonly string[];
  },
): Promise<RenderOutcome> {
  const { format, variant } = input;
  const store = createRenderingStore(deps.db);
  if (input.variantId) {
    const cached = (await store.list(input.variantId)).find(
      (r) => r.format === format,
    );
    if (cached?.status === "rejected") return fallback(format, variant);
    // Le cache est relu par le schéma : un contenu illisible retombe sur le texte.
    if (cached?.status === "ok")
      return outcomeOf(format, cached.content) ?? fallback(format, variant);
  }
  if (!deps.aiConfigured) return fallback(format, variant);
  const common = {
    ai: deps.ai,
    statement: variant.statement,
    rendered: variant.rendered,
    answer: variant.answer,
    context: {
      organizationId: input.organizationId,
      learnerId: input.learnerId,
    },
  };
  const result =
    format === "comics"
      ? await adaptToComics({ ...common, interests: input.interests ?? [] })
      : await adaptToEasyReading(common);
  if (!result.ok) {
    // Reformulation infidèle : refus gardé, pour ne pas repayer le même échec.
    if (result.error.kind === "unfaithful" && input.variantId)
      await store.save({
        variantId: input.variantId,
        format,
        status: "rejected",
        content: null,
        model: null,
      });
    return fallback(format, variant);
  }
  if (input.variantId)
    await store.save({
      variantId: input.variantId,
      format,
      status: "ok",
      content: result.value.content,
      model: result.value.model,
    });
  return outcomeOf(format, result.value.content) ?? fallback(format, variant);
}

/** Formats de l'espace élève : choix du format, figure, reformulations. */
export function learnerFormatRoutes(deps: Deps) {
  const exercises = createExerciseStore(deps.db);
  // Chaque reformulation coûte un appel d'IA : quelques-unes par quart d'heure suffisent.
  const limiter = createRateLimiter({
    max: 12,
    windowMs: 15 * 60 * 1000,
    now: deps.now,
  });
  /** Reformulations simultanées d'une même variante : un seul appel. */
  const inFlight = new Map<string, Promise<RenderOutcome>>();

  async function ownVariant(learnerId: LearnerId, id: string) {
    const variant = await exercises.getVariant(asExerciseVariantId(id));
    if (!variant || variant.learnerId !== learnerId) return null;
    const intent = await exercises.getIntent(variant.intentId);
    return intent ? { variant, intent } : null;
  }

  /** Centres d'intérêt affirmés du profil, au libellé sûr (décor de la BD). */
  const interestsOf = (hypotheses: ReturnType<typeof projectHypotheses>) =>
    hypotheses.hypotheses
      .filter((h) => h.status === "supported" && h.key.startsWith("interest:"))
      .map((h) => h.key.slice("interest:".length))
      .filter(isSafeInterestLabel)
      .slice(0, 2);

  return new Hono<Env>()
    .use(requireSession(deps))
    .get(
      "/variants/:id/presentation",
      zValidator("param", z.object({ id: z.uuid() })),
      async (c) => {
        const learnerId = asLearnerId(c.get("user").id);
        const found = await ownVariant(learnerId, c.req.valid("param").id);
        if (!found) return fail(c, 404, "not_found");
        const { variant, intent } = found;
        const { events } = await learnerModel(deps.db, learnerId);
        const { figure, manipulable } = figureOf(intent.task, variant);
        const cached = await createRenderingStore(deps.db).list(variant.id);
        const comicsCached = cached.find(
          (r) => r.format === "comics" && r.status === "ok",
        );
        const easyCached = cached.find(
          (r) => r.format === "easy_reading" && r.status === "ok",
        );
        const comicsRejected = cached.some(
          (r) => r.format === "comics" && r.status === "rejected",
        );
        const available: PresentationFormat[] = ["easy_reading", "audio"];
        if (figure) available.push("diagram");
        if (comicsCached || (deps.aiConfigured && !comicsRejected))
          available.push("comics");
        // Seulement les besoins actifs et consentis ; ils ne sortent pas d'ici.
        const needs = (
          await createHealthStore(deps.db, deps.healthKey).list(learnerId)
        )
          .filter((n) => n.active && n.consent === "given")
          .map((n) => n.need);
        const choice = choosePresentation({
          available,
          hypotheses: projectHypotheses(events).hypotheses,
          outcomes: measureFormats(events),
          needs,
        });
        const comics = comicsSchema.safeParse(comicsCached?.content);
        const easy = easyReadingSchema.safeParse(easyCached?.content);
        return c.json(
          {
            format: choice.format,
            reason: choice.reason,
            formats: choice.ranking.map((r) => r.format),
            figure,
            manipulable,
            comics: comics.success ? comics.data : null,
            easyReading: easy.success
              ? easy.data
              : splitSentences(variant.statement),
            easyReadingAdapted: easy.success,
          },
          200,
        );
      },
    )
    .post(
      "/variants/:id/render",
      zValidator("param", z.object({ id: z.uuid() })),
      zValidator("json", z.object({ format: renderable })),
      async (c) => {
        const learnerId = asLearnerId(c.get("user").id);
        const found = await ownVariant(learnerId, c.req.valid("param").id);
        if (!found) return fail(c, 404, "not_found");
        const { variant, intent } = found;
        // Un rendu coûte un appel à l'IA : même contrôle d'abonnement que la
        // réponse à l'exercice.
        if (
          !(await accessGuard(
            deps.db,
            deps.billing.access,
            learnerId,
            deps.now(),
          ).notion(intent.notionId))
        )
          return subscriptionRequired(c);
        const format = c.req.valid("json").format;
        const key = `${variant.id}:${format}`;
        const pending = inFlight.get(key);
        if (pending) return c.json({ ok: true, ...(await pending) }, 200);
        const cached = (
          await createRenderingStore(deps.db).list(variant.id)
        ).some((r) => r.format === format);
        // La limite ne compte que les vrais appels (le cache est gratuit).
        if (!cached && deps.aiConfigured && !limiter.hit(learnerId))
          return c.json({ ok: true, ...fallback(format, variant) }, 200);
        const { events } = await learnerModel(deps.db, learnerId);
        const job = renderFormat(deps, {
          format,
          variant,
          variantId: variant.id,
          learnerId,
          organizationId: intent.organizationId,
          interests: interestsOf(projectHypotheses(events)),
        }).finally(() => inFlight.delete(key));
        inFlight.set(key, job);
        return c.json({ ok: true, ...(await job) }, 200);
      },
    );
}
