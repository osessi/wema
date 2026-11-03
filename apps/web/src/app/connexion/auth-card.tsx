import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { LegalLinks } from "../../components/legal/legal-links";

/** Cadre commun de la connexion et de l'inscription : logo, carte centrée. */
export async function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const t = await getTranslations("app");
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-brand font-display text-lg font-extrabold text-ink-on-brand">
          W
        </span>
        <span className="font-display text-2xl font-bold">{t("name")}</span>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
        {footer ? (
          <CardFooter className="justify-center text-sm text-muted-foreground">
            {footer}
          </CardFooter>
        ) : null}
      </Card>
      <LegalLinks />
    </main>
  );
}
