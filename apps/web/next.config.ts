import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const apiUrl = process.env.WEMA_API_URL ?? "http://localhost:4000";
const dev = process.env.NODE_ENV !== "production";
// Tiers autorisés, et eux seuls : la visio (Jitsi, domaine réglable) et le
// widget de paiement Mobile Money (Kkiapay).
const jitsi = `https://${process.env.WEMA_JITSI_DOMAIN?.trim() || "meet.jit.si"}`;
const kkiapay = "https://*.kkiapay.me";

// Politique de sécurité du contenu : tout vient de Wema (polices auto-hébergées
// par next/font, aucun script tiers). « unsafe-inline » pour les scripts reste
// nécessaire aux scripts d'hydratation de Next sans nonce ; « unsafe-eval »
// seulement en développement (rechargement à chaud).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://cdn.kkiapay.me`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  `connect-src 'self' ${kkiapay}${dev ? " ws: wss:" : ""}`,
  `frame-src ${jitsi} ${kkiapay}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Micro (dictée, visio) et caméra (photo de copie, visio) : Wema et sa salle de visio.
  {
    key: "Permissions-Policy",
    value: `camera=(self "${jitsi}"), microphone=(self "${jitsi}"), display-capture=(self "${jitsi}"), geolocation=(), payment=()`,
  },
  ...(dev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]),
];

const config: NextConfig = {
  // Dossier de sortie : un second serveur (tests e2e, port 3100) prend le sien,
  // car Next verrouille un dossier par instance.
  distDir: process.env.WEMA_NEXT_DIST_DIR || ".next",
  transpilePackages: ["@wema/ui"],
  // Image Docker légère : serveur autonome avec seulement les fichiers utiles
  // (le traçage part de la racine du monorepo pour inclure les paquets).
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Le serveur API est servi sous la même origine que le web : le cookie de
  // session reste « first-party » et les écritures passent le contrôle d'origine.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
  // TypeScript 7 n'expose plus d'API JavaScript : la vérification des types
  // est faite par `pnpm typecheck` (tsc), pas par `next build`.
  typescript: { ignoreBuildErrors: true },
  // Les appels à l'IA (banque de la semaine, relecture d'une copie) peuvent
  // dépasser les 30 s par défaut du relais vers l'API.
  experimental: { proxyTimeout: 120_000 },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(config);
