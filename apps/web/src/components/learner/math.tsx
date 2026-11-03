"use client";

import "mathlive/static.css";
import { Input } from "@wema/ui/components/ui/input";
import { useTranslations } from "next-intl";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

type Mathlive = typeof import("mathlive");

let loading: Promise<Mathlive> | null = null;

/** Charge MathLive dans le navigateur seulement (une fois par page). */
function loadMathlive(): Promise<Mathlive> {
  loading ??= import("mathlive").then((m) => {
    // Les polices viennent de mathlive/static.css, déjà chargé ; pas de sons.
    m.MathfieldElement.fontsDirectory = null;
    m.MathfieldElement.soundsDirectory = null;
    return m;
  });
  return loading;
}

/**
 * Réponse au format lu par services/math : écriture « ascii » (x=3, sqrt(2),
 * (7)/(2)…), le texte libre (« ou ») gardé tel quel, sans guillemets.
 */
export function toAnswerText(ascii: string): string {
  return ascii
    .replace(/"([^"]*)"/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Énoncé dont les formules (champs rendus par services/math) sont affichées en LaTeX. */
export function MathText({
  text,
  rendered,
}: {
  text: string;
  rendered: Record<string, { text: string; latex: string }>;
}) {
  const [markup, setMarkup] = useState<Map<string, string> | null>(null);
  const pieces = useMemo(
    () =>
      Object.values(rendered).filter(
        (r) => r.text.length > 0 && text.includes(r.text),
      ),
    [text, rendered],
  );

  useEffect(() => {
    if (pieces.length === 0) return;
    let alive = true;
    loadMathlive()
      .then((m) => {
        if (alive)
          setMarkup(
            new Map(
              pieces.map((p) => [
                p.text,
                m.convertLatexToMarkup(p.latex, { defaultMode: "inline-math" }),
              ]),
            ),
          );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pieces]);

  if (pieces.length === 0) return <>{text}</>;
  // Découpe l'énoncé autour des formules connues.
  const parts: { text: string; math: boolean }[] = [];
  let rest = text;
  while (rest.length > 0) {
    let best: { index: number; piece: string } | null = null;
    for (const p of pieces) {
      const index = rest.indexOf(p.text);
      if (index >= 0 && (best === null || index < best.index))
        best = { index, piece: p.text };
    }
    if (!best) {
      parts.push({ text: rest, math: false });
      break;
    }
    if (best.index > 0)
      parts.push({ text: rest.slice(0, best.index), math: false });
    parts.push({ text: best.piece, math: true });
    rest = rest.slice(best.index + best.piece.length);
  }
  return (
    <>
      {parts.map((p, i) => {
        const html = p.math ? markup?.get(p.text) : undefined;
        return html ? (
          <span
            // biome-ignore lint/security/noDangerouslySetInnerHtml: rendu MathLive d'un LaTeX produit par services/math
            dangerouslySetInnerHTML={{ __html: html }}
            // biome-ignore lint/suspicious/noArrayIndexKey: découpage fixe de l'énoncé
            key={i}
          />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: découpage fixe de l'énoncé
          <Fragment key={i}>{p.text}</Fragment>
        );
      })}
    </>
  );
}

/**
 * Champ de réponse mathématique (MathLive). Renvoie la réponse déjà
 * convertie au format de services/math. Si MathLive ne se charge pas, un
 * champ texte simple prend le relais.
 */
export function MathInput({
  id,
  disabled,
  onChange,
}: {
  id: string;
  disabled?: boolean;
  onChange: (answer: string) => void;
}) {
  const t = useTranslations("learner.exercises");
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<InstanceType<Mathlive["MathfieldElement"]> | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "fallback">(
    "loading",
  );
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    let alive = true;
    loadMathlive()
      .then((m) => {
        if (!alive || !host.current) return;
        const mf = new m.MathfieldElement();
        mf.id = id;
        mf.smartMode = false;
        mf.mathVirtualKeyboardPolicy = "auto";
        mf.className =
          "block w-full rounded-md border border-input bg-card px-3 py-2 text-xl";
        mf.addEventListener("input", () =>
          change.current(toAnswerText(mf.getValue("ascii-math"))),
        );
        host.current.replaceChildren(mf);
        field.current = mf;
        setState("ready");
      })
      .catch(() => {
        if (alive) setState("fallback");
      });
    return () => {
      alive = false;
      field.current?.remove();
      field.current = null;
    };
  }, [id]);

  useEffect(() => {
    if (field.current) field.current.readOnly = disabled === true;
  }, [disabled]);

  if (state === "fallback")
    return (
      <Input
        id={id}
        disabled={disabled}
        className="font-math text-lg"
        onChange={(e) => onChange(e.target.value.trim())}
      />
    );
  return (
    <div>
      <div ref={host} />
      {state === "loading" && (
        <p className="text-sm text-muted-foreground">{t("loadingField")}</p>
      )}
    </div>
  );
}
