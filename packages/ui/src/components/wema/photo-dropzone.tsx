"use client";

import { Camera, ImageSquare, UploadSimple } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

/** Poids maximal d'une photo préparée (même borne que l'API). */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
/** Côté le plus long après réduction : assez pour lire une écriture manuscrite. */
export const PHOTO_MAX_SIDE = 2000;
/** Formats acceptés depuis la galerie. */
export const PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif";

export type PhotoProblem = "decode" | "photo_too_large";

/**
 * Réencode la photo en JPEG réduit : plus légère à envoyer, lisible par tous
 * les modèles (un HEIC ouvert par l'appareil devient JPEG), et sans les
 * métadonnées de la photo d'origine (lieu, appareil). Repris de
 * `learner/photo-review.tsx`.
 */
export async function preparePhoto(
  file: File,
  maxSide: number = PHOTO_MAX_SIDE,
): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
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

export interface PhotoDropzoneLabels {
  drop: string;
  dropHint: string;
  takePhoto: string;
  chooseImage: string;
  preparing: string;
  preview: string;
  confirm: string;
  sending: string;
  retake: string;
  /** Messages des problèmes détectés avant l'envoi. */
  decode: string;
  photo_too_large: string;
}

const DEFAULT_LABELS: PhotoDropzoneLabels = {
  drop: "Déposez votre photo ici",
  dropHint: "ou choisissez-la : JPEG, PNG, WebP ou HEIC, 5 Mo au plus.",
  takePhoto: "Prendre une photo",
  chooseImage: "Choisir une image",
  preparing: "Préparation de la photo…",
  preview: "Aperçu de votre photo",
  confirm: "Envoyer cette photo",
  sending: "Envoi en cours…",
  retake: "Changer de photo",
  decode:
    "Impossible d'ouvrir cette image sur votre appareil. Essayez « Prendre une photo » ou une image en JPEG.",
  photo_too_large:
    "Votre photo est trop lourde (5 Mo au plus). Reprenez-la ou choisissez une image plus légère.",
};

export interface PhotoDropzoneProps {
  /** Envoi de la photo préparée (JPEG réduit). */
  onSubmit: (photo: Blob) => void;
  /** Envoi en cours (géré par l'appelant). */
  sending?: boolean | undefined;
  /** Erreur renvoyée par le serveur, affichée en `alert`. */
  error?: ReactNode | undefined;
  /** Mention sous l'aperçu (confidentialité). */
  note?: ReactNode | undefined;
  labels?: Partial<PhotoDropzoneLabels> | undefined;
  maxBytes?: number | undefined;
  maxSide?: number | undefined;
  /** Appelé à chaque nouvelle photo choisie (efface un retour précédent). */
  onPick?: (() => void) | undefined;
  /** Vide l'aperçu quand la valeur change (après un envoi réussi). */
  resetKey?: string | number | undefined;
  className?: string | undefined;
}

/**
 * Téléversement d'une photo (modèle Dice UI `file-upload`, sans dépendance) :
 * glisser-déposer, appareil photo, galerie, aperçu, puis « Envoyer » ou
 * « Changer ». Reprend les contraintes de `learner/photo-review.tsx` :
 * réencodage JPEG, 2000 px de côté, 5 Mo au plus.
 */
export function PhotoDropzone({
  onSubmit,
  sending = false,
  error,
  note,
  labels: labelsProp,
  maxBytes = PHOTO_MAX_BYTES,
  maxSide = PHOTO_MAX_SIDE,
  onPick,
  resetKey,
  className,
}: PhotoDropzoneProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState<PhotoProblem | null>(null);
  const [over, setOver] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `resetKey` vide l'aperçu
  useEffect(() => {
    setPhoto(null);
  }, [resetKey]);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function choose(file: File | undefined) {
    if (!file) return;
    onPick?.();
    setProblem(null);
    setPreparing(true);
    const prepared = await preparePhoto(file, maxSide);
    setPreparing(false);
    if (!prepared) return setProblem("decode");
    if (prepared.size > maxBytes) return setProblem("photo_too_large");
    setPhoto(prepared);
  }

  const busy = preparing || sending;
  const shownError = problem ? labels[problem] : error;

  return (
    <div data-slot="photo-dropzone" className={cn("space-y-3", className)}>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {photo && preview ? (
        <div className="space-y-3">
          <img
            src={preview}
            alt={labels.preview}
            className="max-h-80 w-full rounded-card border bg-muted object-contain"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              aria-busy={sending || undefined}
              onClick={() => onSubmit(photo)}
            >
              {sending ? labels.sending : labels.confirm}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setPhoto(null)}
            >
              {labels.retake}
            </Button>
          </div>
          {note ? (
            <p className="text-xs text-muted-foreground">{note}</p>
          ) : null}
        </div>
      ) : (
        // biome-ignore lint/a11y/noStaticElementInteractions: zone de dépôt pour la souris ; les boutons couvrent le clavier
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(e) => {
            const next = e.relatedTarget;
            if (!(next instanceof Node) || !e.currentTarget.contains(next))
              setOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (!busy) void choose(e.dataTransfer.files[0]);
          }}
          data-over={over || undefined}
          className={cn(
            "flex flex-col items-center gap-3 rounded-card border-2 border-dashed px-4 py-8 text-center transition-colors",
            over ? "border-brand bg-brand-soft" : "border-border bg-muted/40",
          )}
        >
          <span
            aria-hidden
            className="grid size-12 place-items-center rounded-full bg-card text-foreground shadow-xs"
          >
            <UploadSimple className="size-6" />
          </span>
          <div className="space-y-1">
            <p className="font-medium">{labels.drop}</p>
            <p className="text-sm text-muted-foreground">{labels.dropHint}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => camera.current?.click()}
            >
              <Camera aria-hidden />
              {labels.takePhoto}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => gallery.current?.click()}
            >
              <ImageSquare aria-hidden />
              {labels.chooseImage}
            </Button>
          </div>
          {preparing ? (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {labels.preparing}
            </p>
          ) : null}
        </div>
      )}

      {shownError ? (
        <p role="alert" className="text-sm text-destructive">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
