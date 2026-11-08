import "./globals.css";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import type { ReactNode } from "react";
import { SITE_URL } from "../lib/site";
import { ContactDialog } from "../wa/components/site/contact-dialog";
import { SiteFooter } from "../wa/components/site/footer";
import { SiteHeader } from "../wa/components/site/header";
import { PageBackdrop } from "../wa/components/v2/page-backdrop";
import { ThemeScript } from "../wa/ui/patterns/theme-toggle";

// Système repris de ZeroAds / Winner Agency : Geist (texte et titres) et
// Geist Mono (étiquettes). Lexend sert à la « lecture facile » des figures.
const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend" });

const description =
  "Wema donne à chaque élève un prof particulier IA par matière. Il ne donne jamais la réponse : il questionne, propose des indices et adapte chaque exercice à l'élève. Les parents et les profs voient ses progrès, preuves à l'appui.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Wema, un prof particulier IA par matière",
    template: "%s · Wema",
  },
  description,
  applicationName: "Wema",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Wema",
    title: "Wema, un prof particulier IA par matière",
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wema, un prof particulier IA par matière",
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0e0b" },
  ],
};

const JS_FLAG = "document.documentElement.classList.add('js')";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${GeistSans.variable} ${GeistMono.variable} ${lexend.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: chaîne constante, aucune entrée. */}
        <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium text-foreground shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Aller au contenu
        </a>
        <PageBackdrop />
        <SiteHeader />
        <main id="main" className="relative">
          {children}
        </main>
        <SiteFooter />
        <ContactDialog />
      </body>
    </html>
  );
}
