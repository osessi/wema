import path from "node:path";
import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

// Site de présentation : aucune ressource tierce (polices auto-hébergées par
// next/font, aucun script externe). « unsafe-inline » reste nécessaire aux
// scripts d'hydratation de Next sans nonce ; « unsafe-eval » en développement.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const config: NextConfig = {
  // Même déploiement que apps/web : serveur autonome dans une image Docker.
  // Toutes les pages sont pré-rendues au build (statiques) ; le serveur ne fait
  // que les servir, avec les en-têtes de sécurité ci-dessous.
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
  // L'ancienne page commune profs et écoles a été séparée en deux.
  async redirects() {
    return [
      {
        source: "/profs-et-ecoles",
        destination: "/profs-particuliers",
        permanent: true,
      },
    ];
  },
  // TypeScript 7 n'expose plus d'API JavaScript : `pnpm typecheck` vérifie.
  typescript: { ignoreBuildErrors: true },
};

export default config;
