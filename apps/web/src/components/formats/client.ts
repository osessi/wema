"use client";

import type { AppType } from "@wema/api";
import { hc } from "hono/client";

/**
 * Client typé de l'API depuis le navigateur (même origine, cookie de session
 * envoyé par le navigateur) : les réponses des formats sont typées par le serveur.
 */
export function browserApi() {
  return hc<AppType>(window.location.origin).api;
}

/** Reformulation d'une variante de l'élève (BD ou lecture facile) ; null si la requête échoue. */
export async function renderVariant(
  variantId: string,
  format: "comics" | "easy_reading",
) {
  try {
    const res = await browserApi().learner.variants[":id"].render.$post({
      param: { id: variantId },
      json: { format },
    });
    const body = await res.json();
    return "error" in body ? null : body;
  } catch {
    return null;
  }
}

/** Aperçu d'une variante pour le prof, dans un format (même graine : même variante). */
export async function previewVariant(input: {
  orgId: string;
  exerciseId: string;
  level: 1 | 2 | 3;
  scaffolded: boolean;
  seed: number;
  format?: "comics" | "easy_reading";
}) {
  try {
    const res = await browserApi().admin.organizations[":id"].exercises[
      ":intentId"
    ].preview.$post({
      param: { id: input.orgId, intentId: input.exerciseId },
      json: {
        level: input.level,
        scaffolded: input.scaffolded,
        seed: input.seed,
        ...(input.format ? { format: input.format } : {}),
      },
    });
    const body = await res.json();
    return "error" in body ? null : body;
  } catch {
    return null;
  }
}
