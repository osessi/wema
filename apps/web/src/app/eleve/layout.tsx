import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SpaceLayout } from "../../components/shell/space-layout";

export default async function Layout({ children }: { children: ReactNode }) {
  const t = await getTranslations("learner.nav");
  return (
    <SpaceLayout
      space="learner"
      nav={[{ href: "/eleve", label: t("home"), icon: "home" }]}
    >
      {children}
    </SpaceLayout>
  );
}
