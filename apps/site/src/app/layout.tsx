import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Lexend, Urbanist } from "next/font/google";
import type { ReactNode } from "react";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { SITE_URL } from "../lib/site";

// Charte : Urbanist pour les titres, Inter pour le texte, Lexend pour la
// lecture facile ; Geist Mono pour les étiquettes (système ZeroAds / Winner).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const urbanist = Urbanist({ subsets: ["latin"], variable: "--font-urbanist" });
const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

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
  themeColor: "#f6f4ec",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${urbanist.variable} ${lexend.variable} ${geistMono.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        <div aria-hidden="true" className="grain" />
        <div aria-hidden="true" className="page-rails" />
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
        >
          Aller au contenu
        </a>
        <SiteHeader />
        <main id="contenu" className="relative z-10 flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
