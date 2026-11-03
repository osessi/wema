import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { ShellNavItem } from "../../components/shell/app-shell";
import { SpaceLayout } from "../../components/shell/space-layout";
import { getSpaces } from "../../lib/spaces";

export default async function Layout({ children }: { children: ReactNode }) {
  const t = await getTranslations("guardian.nav");
  const { session } = await getSpaces();
  const nav: ShellNavItem[] = [
    { href: "/parent", label: t("home"), icon: "children" },
  ];
  // La gestion de la famille (comptes des enfants, liens) pour qui l'administre.
  if (
    session.organizations.some(
      (o) => o.kind === "family" && o.permissions.includes("members.manage"),
    )
  )
    nav.push({ href: "/parent/famille", label: t("family"), icon: "members" });
  return (
    <SpaceLayout space="guardian" nav={nav}>
      {children}
    </SpaceLayout>
  );
}
