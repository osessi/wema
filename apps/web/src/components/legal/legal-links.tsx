import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";

export const LEGAL_PAGES = [
  { key: "mentions", href: "/mentions-legales" },
  { key: "privacy", href: "/confidentialite" },
  { key: "terms", href: "/conditions" },
  { key: "cookies", href: "/cookies" },
] as const;

/** Liens vers les pages légales (connexion, inscription, pied de la coquille). */
export function LegalLinks({ className }: { className?: string }) {
  const t = useTranslations("legal.links");
  return (
    <nav
      aria-label={t("label")}
      className={cn(
        "flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {LEGAL_PAGES.map((p) => (
        <Link
          key={p.key}
          href={p.href}
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          {t(p.key)}
        </Link>
      ))}
    </nav>
  );
}
