import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SpaceLayout } from "../../components/shell/space-layout";

export default async function Layout({ children }: { children: ReactNode }) {
  const t = await getTranslations("teacher.nav");
  return (
    <SpaceLayout
      space="teacher"
      nav={[
        { href: "/prof", label: t("home"), icon: "home" },
        { href: "/prof/banque", label: t("bank"), icon: "bank" },
        { href: "/prof/exercices", label: t("exercises"), icon: "exercises" },
        {
          href: "/prof/messages",
          label: (await getTranslations("messages"))("nav"),
          icon: "messages",
        },
      ]}
    >
      {children}
    </SpaceLayout>
  );
}
