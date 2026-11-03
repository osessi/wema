import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { LegalLinks } from "../../../components/legal/legal-links";

/** Cadre des pages du compte : en dehors des espaces, avec un retour à Wema. */
export async function AccountFrame({ children }: { children: ReactNode }) {
  const t = await getTranslations("legal");
  const tApp = await getTranslations("app");
  return (
    <main className="min-h-svh bg-background px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand font-display text-base font-extrabold text-ink-on-brand">
              W
            </span>
            <span className="font-display text-xl font-bold">
              {tApp("name")}
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {t("back")}
          </Link>
        </header>
        {children}
        <footer className="border-t pt-6">
          <LegalLinks />
        </footer>
      </div>
    </main>
  );
}
