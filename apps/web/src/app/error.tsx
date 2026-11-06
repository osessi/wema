"use client";

import { Button } from "@wema/ui/components/ui/button";
import Link from "next/link";
import { useTranslations } from "next-intl";

/** Erreur d'une page : message clair, nouvel essai ou retour à l'accueil. */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("shell.error");
  return (
    <main className="grid min-h-[60svh] place-items-center bg-background p-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("body")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>{t("retry")}</Button>
          <Button variant="outline" asChild>
            <Link href="/">{t("home")}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
