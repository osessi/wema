"use client";

import { ThemeProvider as NextThemes } from "next-themes";
import type { ReactNode } from "react";

// Le script de next-themes (thème posé avant l'affichage) ne sert qu'au rendu
// serveur. Quand React rend la page dans le navigateur (par exemple une page
// 404 dans un espace), un <script> exécutable y déclenche une erreur de
// console ; déclaré comme bloc de données côté navigateur, il est ignoré.
const scriptProps = {
  type: typeof window === "undefined" ? "text/javascript" : "application/json",
};

/** Thème clair « Crayon » ou sombre « Nuit » (classe .dark sur <html>). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes
      attribute="class"
      defaultTheme="light"
      enableSystem
      scriptProps={scriptProps}
    >
      {children}
    </NextThemes>
  );
}
