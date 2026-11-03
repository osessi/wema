import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SpaceLayout } from "../../components/shell/space-layout";

export default async function Layout({ children }: { children: ReactNode }) {
  const t = await getTranslations("guardian.nav");
  return (
    <SpaceLayout
      space="guardian"
      nav={[{ href: "/parent", label: t("home"), icon: "home" }]}
    >
      {children}
    </SpaceLayout>
  );
}
