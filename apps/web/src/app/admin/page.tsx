import { Alert, PageHeader } from "@wema/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { visibleSections } from "../../lib/nav";
import { getSession } from "../../lib/session";

export default async function AdminHome() {
  const session = await getSession();
  const t = await getTranslations();
  const visible = visibleSections(session);
  return (
    <>
      <PageHeader
        title={t("home.title", { name: session.user.displayName })}
        subtitle={t("home.subtitle")}
      />
      {visible.length === 0 ? (
        <Alert>{t("home.noAccess")}</Alert>
      ) : (
        <div className="w-grid">
          {visible.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              className="w-card"
              style={{ color: "inherit" }}
            >
              <h2 className="w-card__title">{t(`nav.${s.key}`)}</h2>
              <p className="w-muted" style={{ margin: 0 }}>
                {t(`home.cards.${s.key}`)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
