import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { tryLoad } from "../../components/school/try-load";
import type { NavIcon } from "../../components/shell/icons";
import { SpaceLayout } from "../../components/shell/space-layout";
import { serverApi } from "../../lib/api-server";
import { visibleSections } from "../../lib/nav";
import { getSession } from "../../lib/session";

const ICONS: Record<string, NavIcon> = {
  curriculum: "curriculum",
  subjects: "bank",
  organizations: "members",
  settings: "settings",
  ai: "tutor",
  audit: "checklist",
  billing: "billing",
  collective: "progress",
  costs: "overview",
  contacts: "messages",
  review: "exercises",
  diagnostic: "agenda",
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  const t = await getTranslations("nav");
  // Pastilles du menu : éléments à valider, demandes de contact non traitées.
  const counts = await tryLoad((await serverApi()).admin.review.counts.$get());
  const countOf = (key: string) =>
    key === "review"
      ? (counts?.toReview ?? undefined)
      : key === "contacts"
        ? (counts?.contacts ?? undefined)
        : undefined;
  return (
    <SpaceLayout
      space="admin"
      nav={[
        { href: "/admin", label: t("home"), icon: "home" },
        ...visibleSections(session).map((s) => {
          const count = countOf(s.key);
          return {
            href: s.href,
            label: t(s.key),
            icon: ICONS[s.key] ?? "home",
            ...(count !== undefined ? { count } : {}),
          };
        }),
      ]}
    >
      <div className="flex flex-col gap-6">{children}</div>
    </SpaceLayout>
  );
}
