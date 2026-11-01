import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Sidebar } from "../../components/sidebar";
import { SECTIONS } from "../../lib/nav";
import { getSession } from "../../lib/session";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  const t = await getTranslations("nav");
  // Un membre d'une école voit « Organisations » s'il gère les membres ou les rôles de son organisation.
  const orgPermissions = new Set(
    session.organizations.flatMap((o) => o.permissions),
  );
  const visible = SECTIONS.filter(
    (s) =>
      session.permissions.includes(s.permission) ||
      (s.key === "organizations" && orgPermissions.has("roles.manage")),
  );
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
