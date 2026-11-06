import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";

// Next ne préfixe pas les adresses du manifeste : on ajoute le chemin de l'app.
const base = process.env.WEMA_BASE_PATH ?? "";

/** Manifeste PWA : Wema s'installe sur l'écran d'accueil d'un téléphone. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("app");
  return {
    name: t("name"),
    short_name: t("name"),
    description: t("tagline"),
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#f7f4ec",
    theme_color: "#ffc529",
    lang: "fr",
    icons: [
      {
        src: `${base}/icons/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: `${base}/icons/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: `${base}/icons/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
