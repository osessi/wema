import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Sidebar } from "../../components/sidebar";
import { visibleSections } from "../../lib/nav";
import { getSession } from "../../lib/session";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  const t = await getTranslations("nav");
  const visible = visibleSections(session);
  return (
    <div className="w-shell">
      <Sidebar
        userName={session.user.displayName}
        items={[
          { href: "/admin", label: t("home") },
          ...visible.map((s) => ({ href: s.href, label: t(s.key) })),
        ]}
      />
      <main className="w-main">{children}</main>
    </div>
  );
}
