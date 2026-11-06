import { Button } from "@wema/ui/components/ui/button";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("shell.notFound");
  return (
    <main className="grid min-h-svh place-items-center bg-background p-4">
      <div className="max-w-md space-y-4 text-center">
        <p className="font-display text-6xl font-bold text-muted-foreground">
          404
        </p>
        <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("body")}</p>
        <Button asChild>
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
    </main>
  );
}
