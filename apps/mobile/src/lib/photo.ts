import { fetch } from "expo/fetch";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { type ApiResult, onSessionLostNow, sessionHeaders } from "./api";
import { apiBaseUrl } from "./config";
import { errorCode, read } from "./read";

/** Côté le plus long après réduction : assez pour lire une écriture manuscrite. */
const MAX_SIDE = 2000;

export type StepStatus = "correct" | "incorrect" | "unverified";

export type Review =
  | { readable: false }
  | {
      readable: true;
      steps: { text: string; status: StepStatus }[];
      stuckStep: number | null;
      issue: string | null;
      feedback: string;
    };

const isStatus = (v: unknown): v is StepStatus =>
  v === "correct" || v === "incorrect" || v === "unverified";

export function toReview(data: unknown): Review | null {
  const review = read(data, "review");
  const readable = read(review, "readable");
  if (readable === false) return { readable: false };
  const steps = read(review, "steps");
  const feedback = read(review, "feedback");
  const stuck = read(review, "stuckStep");
  const issue = read(review, "issue");
  if (
    readable !== true ||
    !Array.isArray(steps) ||
    typeof feedback !== "string"
  )
    return null;
  return {
    readable: true,
    steps: steps.flatMap((s: unknown) => {
      const text = read(s, "text");
      const status = read(s, "status");
      return typeof text === "string" && isStatus(status)
        ? [{ text, status }]
        : [];
    }),
    stuckStep: typeof stuck === "number" ? stuck : null,
    issue: typeof issue === "string" ? issue : null,
    feedback,
  };
}

/**
 * Réencode la photo en JPEG réduit : plus légère, lisible par tous les
 * modèles (un HEIC d'iPhone devient JPEG) et sans les métadonnées d'origine
 * (lieu, appareil).
 */
export async function preparePhoto(
  uri: string,
  width: number,
  height: number,
): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_SIDE)
    context.resize(
      width >= height
        ? { width: MAX_SIDE, height: null }
        : { width: null, height: MAX_SIDE },
    );
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    compress: 0.8,
    format: SaveFormat.JPEG,
  });
  return saved.uri;
}

/** Envoie la photo (POST /api/learner/variants/:id/photo, multipart). */
export async function sendPhoto(
  variantId: string,
  uri: string,
): Promise<ApiResult<Review>> {
  const form = new FormData();
  // Fichier local lu par expo-file-system (un Blob), envoyé par expo/fetch.
  form.append("photo", new File(uri), "copie.jpg");
  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(
      `${apiBaseUrl()}/api/learner/variants/${encodeURIComponent(variantId)}/photo`,
      { method: "POST", headers: sessionHeaders(), body: form },
    );
  } catch {
    return { ok: false, code: "network", status: 0 };
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) onSessionLostNow();
    return { ok: false, code: errorCode(json), status: res.status };
  }
  const review = toReview(json);
  return review
    ? { ok: true, data: review }
    : { ok: false, code: "generic", status: res.status };
}
