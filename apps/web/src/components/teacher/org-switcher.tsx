import { Button } from "@wema/ui/components/ui/button";
import Link from "next/link";
import { useTranslations } from "next-intl";

/** Choix de l'organisation, quand le prof exerce dans plusieurs. */
export function OrgSwitcher({
  orgs,
  current,
  href,
}: {
  orgs: { id: string; name: string }[];
  current: string;
  /** Lien vers la même page pour une autre organisation. */
  href: (orgId: string) => string;
}) {
  const t = useTranslations("teacher");
  if (orgs.length < 2) return null;
  return (
    <nav aria-label={t("orgSwitcher")} className="flex flex-wrap gap-2">
      {orgs.map((o) => (
        <Button
          key={o.id}
          asChild
          size="sm"
          variant={o.id === current ? "secondary" : "ghost"}
        >
          <Link href={href(o.id)} aria-current={o.id === current || undefined}>
            {o.name}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
