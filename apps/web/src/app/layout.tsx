import "@wema/ui/styles.css";
import "./globals.css";
import { Toaster } from "@wema/ui/components/ui/sonner";
import { TooltipProvider } from "@wema/ui/components/ui/tooltip";
import type { Metadata } from "next";
import { Inter, Lexend, STIX_Two_Text, Urbanist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ThemeProvider } from "../components/theme-provider";

// Charte : Urbanist pour les titres, Inter pour le texte, Lexend pour la
// lecture facile, STIX pour les formules.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const urbanist = Urbanist({ subsets: ["latin"], variable: "--font-urbanist" });
const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend" });
const stix = STIX_Two_Text({ subsets: ["latin"], variable: "--font-stix" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: `${t("name")} · ${t("tagline")}` };
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang={await getLocale()}
      className={`${inter.variable} ${urbanist.variable} ${lexend.variable} ${stix.variable}`}
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
