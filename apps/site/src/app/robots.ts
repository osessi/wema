import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // L'application (/app) et l'API (/api) ne sont pas à indexer.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
