import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { EasyReadingScope } from "../../components/learner/easy-reading";
import { SpaceLayout } from "../../components/shell/space-layout";

export default async function Layout({ children }: { children: ReactNode }) {
  const t = await getTranslations("learner.nav");
  return (
    <SpaceLayout
      space="learner"
      mobileTabs={[
        "/eleve",
        "/eleve/devoirs",
        "/eleve/exercices",
        "/eleve/prof-ia",
        "/eleve/messages",
      ]}
      nav={[
        { href: "/eleve", label: t("home"), icon: "home" },
        {
          href: "/eleve/devoirs",
          label: t("assignments"),
          icon: "assignments",
        },
        { href: "/eleve/exercices", label: t("exercises"), icon: "exercises" },
        { href: "/eleve/prof-ia", label: t("tutor"), icon: "tutor" },
        { href: "/eleve/progression", label: t("progress"), icon: "path" },
        {
          href: "/eleve/agenda",
          label: (await getTranslations("agenda"))("nav"),
          icon: "agenda",
        },
        {
          href: "/eleve/messages",
          label: (await getTranslations("messages"))("nav"),
          icon: "messages",
        },
        { href: "/eleve/profil", label: t("profile"), icon: "profile" },
      ]}
    >
      <EasyReadingScope>{children}</EasyReadingScope>
    </SpaceLayout>
  );
}
