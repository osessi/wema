import "./globals.css";
import { Toaster } from "@wema/ui/components/ui/sonner";
import { TooltipProvider } from "@wema/ui/components/ui/tooltip";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { Lexend, STIX_Two_Text } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ThemeProvider } from "../components/theme-provider";

// Charte, comme le site public : Geist pour le texte et les titres, Geist Mono
// pour les étiquettes ; Lexend pour la lecture facile, STIX pour les formules.
const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend" });
const stix = STIX_Two_Text({ subsets: ["latin"], variable: "--font-stix" });

// Aperçu sur les réseaux : la même vignette que le site public.
const SITE_URL = (
  process.env.WEMA_SITE_URL ?? "https://wema.winneragency.co"
).replace(/\/$/, "");
const OG_IMAGE = `${process.env.WEMA_BASE_PATH ?? "/app"}/og/wema.jpg`;
const OG_DESCRIPTION =
  "Tout le suivi d'un prof particulier, adapté au niveau et au rythme de chaque apprenant.";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  const title = `${t("name")} · ${t("tagline")}`;
  return {
    title,
    metadataBase: new URL(SITE_URL),
    description: OG_DESCRIPTION,
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: "Wema",
      title,
      description: OG_DESCRIPTION,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Wema" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: OG_DESCRIPTION,
      images: [OG_IMAGE],
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang={await getLocale()}
      className={`${GeistSans.variable} ${GeistMono.variable} ${lexend.variable} ${stix.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <NextIntlClientProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
