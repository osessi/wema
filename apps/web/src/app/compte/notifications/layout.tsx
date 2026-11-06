import { ArrowLeft } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

/**
 * Mise en page simple du compte (hors des espaces) : la page de désinscription
 * doit s'ouvrir sans session, depuis un lien reçu par e-mail ou SMS.
 */
export default async function NotificationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations("notifications");
  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft />
          {t("back")}
        </Link>
      </header>
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pb-10">
        {children}
      </main>
    </div>
  );
}
