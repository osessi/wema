import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import type { AiImageType } from "@wema/ai-gateway";
import { createEventStore, createExerciseStore } from "@wema/db";
import { asEventId, asExerciseVariantId, asLearnerId } from "@wema/domain";
import { copyReviewedEvent, createCopyReviewer } from "@wema/tutor";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { fail, requireSession } from "../http";
import { createRateLimiter } from "../rate-limit";
import { describeAnswer, notionInfo } from "../tutor-context";

/** Taille maximale d'une photo de copie. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Format réel de l'image, lu dans ses premiers octets (le type annoncé par le
 * navigateur ne suffit pas). HEIC est reconnu pour être refusé clairement :
 * les modèles ne le lisent pas, et le web le convertit en JPEG avant l'envoi.
 */
export function sniffImage(bytes: Uint8Array): AiImageType | "heic" | null {
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (
    ascii(4, 8) === "ftyp" &&
    ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(
      ascii(8, 12),
    )
  )
    return "heic";
  return null;
}

/**
 * Photo d'une copie : l'élève envoie son raisonnement écrit sur une de ses
 * variantes ; le prof IA le relit et répond sans donner la réponse finale.
 * La photo (donnée d'un mineur) n'est jamais conservée : elle est lue en
 * mémoire, transmise à un fournisseur sans conservation (ZDR), puis oubliée.
 * Seule l'observation entre dans le journal (source « paper »).
 */
export function photoRoutes(deps: Deps) {
  const exercises = createExerciseStore(deps.db);
  const reviewer = createCopyReviewer(deps.ai, { verifier: deps.math });
  // Garde-fou de coût : 10 photos par élève et par quart d'heure.
  const limiter = createRateLimiter({
    max: 10,
    windowMs: 15 * 60 * 1000,
    now: deps.now,
  });

  return new Hono<Env>().use(requireSession(deps)).post(
    "/variants/:id/photo",
    zValidator("param", z.object({ id: z.uuid() })),
    // Marge pour l'enveloppe multipart ; la taille du fichier est contrôlée ensuite.
    bodyLimit({
      maxSize: MAX_PHOTO_BYTES + 64 * 1024,
      onError: (c) => fail(c, 413, "photo_too_large"),
    }),
    async (c) => {
      const learnerId = asLearnerId(c.get("user").id);
      const variant = await exercises.getVariant(
        asExerciseVariantId(c.req.valid("param").id),
      );
      if (!variant || variant.learnerId !== learnerId)
        return fail(c, 404, "not_found");
      const intent = await exercises.getIntent(variant.intentId);
      if (!intent) return fail(c, 404, "not_found");

      const form = await c.req.parseBody().catch(() => null);
      const file = form?.photo;
      if (!(file instanceof File) || file.size === 0)
        return fail(c, 422, "photo_missing");
      if (file.size > MAX_PHOTO_BYTES) return fail(c, 413, "photo_too_large");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mediaType = sniffImage(bytes);
      if (mediaType === null || mediaType === "heic")
        return fail(c, 415, "photo_unsupported_format");

      const info = await notionInfo(deps.db, intent.notionId);
      if (!info) return fail(c, 404, "not_found");
      if (!limiter.hit(learnerId)) return fail(c, 429, "too_many_photos");

      const result = await reviewer.review({
        subjectName: info.subject.name,
        notion: {
          name: info.notion.name,
          description: info.notion.description,
        },
        statement: variant.statement,
        answer: variant.answer,
        expected: describeAnswer(variant.answer),
        misconceptions: info.misconceptions,
        image: { mediaType, data: Buffer.from(bytes).toString("base64") },
        context: { organizationId: null, learnerId },
      });
      // La photo n'est plus référencée : rien n'est écrit sur disque ni en base.
      if (!result.ok) {
        const error = result.error;
        return fail(
          c,
          error.kind === "rate_limited" ? 429 : 503,
          error.kind === "misconfigured"
            ? "ai_not_configured"
            : "ai_unavailable",
        );
      }
      const review = result.value;
      const payload = copyReviewedEvent(review, {
        notionId: intent.notionId,
        exerciseRef: variant.id,
      });
      if (payload) {
        const appended = await createEventStore(deps.db).append({
          id: asEventId(randomUUID()),
          learnerId,
          occurredAt: deps.now(),
          source: "paper",
          payload,
        });
        if (!appended.ok) throw new Error("identifiant d'événement en conflit");
      }
      // L'idée fausse repérée reste dans le profil : on ne l'affiche pas comme un défaut à l'élève.
      return c.json(
        {
          review: review.readable
            ? {
                readable: true as const,
                steps: review.steps,
                stuckStep: review.stuckStep,
                issue: review.issue,
                feedback: review.feedback,
              }
            : { readable: false as const },
        },
        200,
      );
    },
  );
}
