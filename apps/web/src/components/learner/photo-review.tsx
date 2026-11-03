"use client";

import {
  Camera,
  CheckCircle,
  ImageSquare,
  Lightbulb,
  MagnifyingGlass,
  Question,
} from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { cn } from "@wema/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { read } from "../../lib/mutate";

type StepStatus = "correct" | "incorrect" | "unverified";

type Review =
  | { readable: false }
  | {
      readable: true;
      steps: { text: string; status: StepStatus }[];
      stuckStep: number | null;
      issue: string | null;
      feedback: string;
    };

const MAX_BYTES = 5 * 1024 * 1024;
/** Côté le plus long après réduction : assez pour lire une écriture manuscrite. */
const MAX_SIDE = 2000;

const isStatus = (v: unknown): v is StepStatus =>
  v === "correct" || v === "incorrect" || v === "unverified";

function toReview(data: unknown): Review | null {
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
 * Réencode la photo en JPEG réduit : plus légère à envoyer, lisible par tous
 * les modèles (un HEIC ouvert par l'appareil devient JPEG), et sans les
 * métadonnées de la photo d'origine (lieu, appareil).
 */
async function prepare(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85),
    );
  } catch {
    return null;
  }
}

/**
 * Photo de la feuille : l'élève photographie son raisonnement, le prof IA le
 * relit et dit où ça coince, avec une question ou un indice. Le retour ne
 * dit jamais que l'exercice est réussi : seule la réponse saisie, vérifiée
 * par services/math, le dit.
 */
export function PhotoReview({ variantId }: { variantId: string }) {
  const t = useTranslations("learner.photo");
  const errors = useTranslations("learner.errors");
  const router = useRouter();
  const cameraId = useId();
  const galleryId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "preparing" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const message = (code: string) =>
    t.has(`errors.${code}`)
      ? t(`errors.${code}`)
      : errors.has(code)
        ? errors(code)
        : errors("generic");

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    setReview(null);
    setState("preparing");
    const prepared = await prepare(file);
    setState("idle");
    if (!prepared) return setError(message("decode"));
    if (prepared.size > MAX_BYTES) return setError(message("photo_too_large"));
    setPhoto(prepared);
  }

  async function send() {
    if (!photo) return;
    setError(null);
    setState("sending");
    const form = new FormData();
    form.append("photo", photo, "copie.jpg");
    let res: Response;
    try {
      res = await fetch(`/api/learner/variants/${variantId}/photo`, {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
    } catch {
      setState("idle");
      return setError(message("network"));
    }
    const data: unknown = res.headers.get("content-type")?.includes("json")
      ? await res.json()
      : null;
    setState("idle");
    if (!res.ok) {
      const code = read(read(data, "error"), "code");
      if (code === "unauthenticated") router.push("/connexion");
      return setError(message(typeof code === "string" ? code : "generic"));
    }
    const parsed = toReview(data);
    if (!parsed) return setError(message("generic"));
    // La photo n'est plus utile : elle n'est gardée ni ici ni sur le serveur.
    setPhoto(null);
    setReview(parsed);
  }

  const busy = state !== "idle";
  const pickers = (
    <div className="flex flex-wrap gap-3">
      <input
        ref={cameraRef}
        id={cameraId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        id={galleryId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => cameraRef.current?.click()}
      >
        <Camera />
        {t("takePhoto")}
      </Button>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => galleryRef.current?.click()}
      >
        <ImageSquare />
        {t("chooseImage")}
      </Button>
    </div>
  );

  if (!open)
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Camera />
        {t("send")}
      </Button>
    );

  return (
    <section className="space-y-4 rounded-xl border p-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Camera />
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {!photo && !review && pickers}
      {state === "preparing" && (
        <p className="text-sm text-muted-foreground">{t("preparing")}</p>
      )}

      {photo && preview && (
        <div className="space-y-3">
          {/* biome-ignore lint/performance/noImgElement: aperçu local (adresse blob:), rien à optimiser */}
          <img
            src={preview}
            alt={t("preview")}
            className="max-h-80 w-full rounded-lg border bg-muted object-contain"
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={send} disabled={busy}>
              {state === "sending" ? t("reading") : t("confirm")}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setPhoto(null)}
            >
              {t("retake")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("privacy")}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}

      <div aria-live="polite" className="space-y-4">
        {review && !review.readable && (
          <p className="rounded-xl border bg-muted p-4">{t("unreadable")}</p>
        )}
        {review?.readable && (
          <>
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <MagnifyingGlass />
                {t("stepsTitle")}
              </h3>
              <ol className="space-y-2">
                {review.steps.map((step, i) => (
                  <li
                    // Les étapes lues ne changent pas d'ordre : le rang est une clé stable.
                    // biome-ignore lint/suspicious/noArrayIndexKey: liste figée
                    key={i}
                    className={cn(
                      "rounded-lg border p-3",
                      i === review.stuckStep && "bg-peach text-peach-ink",
                    )}
                  >
                    <p className="font-math text-lg">{step.text}</p>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      {step.status === "correct" && (
                        <CheckCircle weight="fill" />
                      )}
                      {step.status === "unverified" && <Question />}
                      {i === review.stuckStep
                        ? t("stepStuck")
                        : step.status === "correct"
                          ? t("stepCorrect")
                          : step.status === "incorrect"
                            ? t("stepIncorrect")
                            : t("stepUnverified")}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
            {(review.issue !== null || review.stuckStep === null) && (
              <div className="space-y-1 rounded-xl border bg-muted p-4">
                <p className="font-semibold">{t("issueTitle")}</p>
                <p>{review.issue ?? t("noIssue")}</p>
              </div>
            )}
            <div className="flex items-start gap-3 rounded-xl border p-4">
              <Lightbulb className="mt-0.5 size-6 shrink-0" />
              <div>
                <p className="font-semibold">{t("feedbackTitle")}</p>
                <p>{review.feedback}</p>
              </div>
            </div>
          </>
        )}
        {review && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("another")}</p>
            {pickers}
          </div>
        )}
      </div>
    </section>
  );
}
