import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";

/** Manifeste PWA : Wema s'installe sur l'écran d'accueil d'un téléphone. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("app");
  return {
    name: t("name"),
    short_name: t("name"),
    description: t("tagline"),
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ec",
    theme_color: "#ffc529",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
