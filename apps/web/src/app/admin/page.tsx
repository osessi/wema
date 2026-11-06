import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../components/page-header";
import { visibleSections } from "../../lib/nav";
import { getSession } from "../../lib/session";
import { Notice } from "./_ui/fields";

export default async function AdminHome() {
  const session = await getSession();
  const t = await getTranslations();
  const visible = visibleSections(session);
  return (
    <>
      <PageHeader
        title={t("home.title", { name: session.user.displayName })}
        description={t("home.subtitle")}
      />
      {visible.length === 0 ? (
        <Notice>{t("home.noAccess")}</Notice>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="font-display text-lg">
                    {t(`nav.${s.key}`)}
                  </CardTitle>
                  <CardDescription>{t(`home.cards.${s.key}`)}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
