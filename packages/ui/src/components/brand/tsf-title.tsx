"use client";

import { type ReactNode, useState } from "react";
import { cn } from "../../lib/utils";
import { useInView } from "./tsf-motion";

export type TsfTitleTag = "h1" | "h2" | "h3" | "h4" | "p" | "div";

export interface TsfTitleProps {
  /**
   * Le titre. Une chaîne est coupée en lignes après chaque phrase (. ! ?) ;
   * un tableau donne les lignes telles quelles ; un nœud React fait une ligne.
   */
  readonly lines: readonly ReactNode[] | ReactNode;
  /** Balise rendue, `h2` par défaut. Une seule balise : le nom accessible reste le texte entier. */
  readonly as?: TsfTitleTag | undefined;
  /**
   * `mount` (défaut) : les lignes montent au premier affichage, en CSS seul
   * (fonctionne au rendu serveur). `view` : quand le titre entre dans l'écran.
   */
  readonly reveal?: "mount" | "view" | undefined;
  readonly id?: string | undefined;
  readonly className?: string | undefined;
}

function titleLines(title: ReactNode): readonly ReactNode[] {
  if (typeof title !== "string") return [title];
  const lines = title.split(/(?<=[.!?])\s+/).filter((line) => line.length > 0);
  return lines.length > 0 ? lines : [title];
}

function isLineList(
  lines: readonly ReactNode[] | ReactNode,
): lines is readonly ReactNode[] {
  return Array.isArray(lines);
}

/**
 * Titre « révélé » du site : chaque ligne monte depuis sous sa ligne de base.
 * Le texte reste en clair dans le DOM (les lecteurs d'écran et les tests le
 * lisent tel quel) ; seul l'affichage glisse. Respecte `prefers-reduced-motion`.
 */
export function TsfTitle({
  lines,
  as: Tag = "h2",
  reveal = "mount",
  id,
  className,
}: TsfTitleProps) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const { seen } = useInView(reveal === "view" ? node : null, 0.3);
  const list = isLineList(lines) ? lines : titleLines(lines);
  return (
    <Tag
      ref={setNode}
      id={id}
      className={cn("tk-title", className)}
      data-reveal={reveal}
      data-seen={reveal === "view" ? (seen ? "1" : "0") : undefined}
    >
      {list.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: les lignes d'un titre ne changent pas d'ordre.
        <span key={index}>
          <span
            style={{
              transitionDelay: `${0.12 + index * 0.1}s`,
              animationDelay: `${0.08 + index * 0.1}s`,
            }}
          >
            {line}
          </span>
        </span>
      ))}
    </Tag>
  );
}
