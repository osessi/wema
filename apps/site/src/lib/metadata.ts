import type { Metadata } from "next";

/**
 * Métadonnées d'une page intérieure. Next remplace l'objet openGraph du
 * gabarit au lieu de le fusionner : on le redonne donc en entier ici.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: "Wema",
      title: `${title} · Wema`,
      description,
      url: path,
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Wema`,
      description,
    },
  };
}
