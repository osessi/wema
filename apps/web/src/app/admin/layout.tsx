import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { NavIcon } from "../../components/shell/icons";
import { SpaceLayout } from "../../components/shell/space-layout";
import { visibleSections } from "../../lib/nav";
import { getSession } from "../../lib/session";

const ICONS: Record<string, NavIcon> = {
  curriculum: "curriculum",
  subjects: "bank",
  organizations: "members",
  settings: "settings",
  audit: "checklist",
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  const t = await getTranslations("nav");
  return (
    <SpaceLayout
      space="admin"
      nav={[
        { href: "/admin", label: t("home"), icon: "home" },
        ...visibleSections(session).map((s) => ({
          href: s.href,
          label: t(s.key),
          icon: ICONS[s.key] ?? "home",
        })),
      ]}
    >
      <div className="w-stack">{children}</div>
    </SpaceLayout>
  );
}
