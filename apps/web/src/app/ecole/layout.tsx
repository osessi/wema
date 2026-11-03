import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { ShellNavItem } from "../../components/shell/app-shell";
import { SpaceLayout } from "../../components/shell/space-layout";
import { getSpaces } from "../../lib/spaces";

export default async function Layout({ children }: { children: ReactNode }) {
  const t = await getTranslations("school.nav");
  const { schools } = await getSpaces();
  const nav: ShellNavItem[] = [];
  // Plusieurs organisations : on commence par le choix, puis un menu par organisation.
  if (schools.length > 1)
    nav.push({ href: "/ecole", label: t("all"), icon: "home" });
  for (const s of schools) {
    const base = `/ecole/${s.id}`;
    const prefix = schools.length > 1 ? `${s.name} · ` : "";
    const can = (p: string) => s.permissions.some((x) => x === p);
    nav.push({ href: base, label: prefix + t("overview"), icon: "overview" });
    if (can("classes.manage"))
      nav.push({
        href: `${base}/classes`,
        label: prefix + t("classes"),
        icon: "classes",
      });
    if (can("members.manage"))
      nav.push({
        href: `${base}/membres`,
        label: prefix + t("members"),
        icon: "members",
      });
    if (can("audit.read"))
      nav.push({
        href: `${base}/journal`,
        label: prefix + t("audit"),
        icon: "checklist",
      });
  }
  return (
    <SpaceLayout space="school" nav={nav}>
      {children}
    </SpaceLayout>
  );
}
