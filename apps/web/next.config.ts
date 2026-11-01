import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const apiUrl = process.env.WEMA_API_URL ?? "http://localhost:4000";

const config: NextConfig = {
  transpilePackages: ["@wema/ui"],
  // Le serveur API est servi sous la même origine que le web : le cookie de
  // session reste « first-party » et les écritures passent le contrôle d'origine.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
  // TypeScript 7 n'expose plus d'API JavaScript : la vérification des types
  // est faite par `pnpm typecheck` (tsc), pas par `next build`.
  typescript: { ignoreBuildErrors: true },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(config);
