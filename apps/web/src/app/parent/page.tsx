import { UsersThree } from "@phosphor-icons/react/ssr";
import { Button } from "@wema/ui/components/ui/button";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChildCard } from "../../components/guardian/child-card";
import { FamilyChecklist } from "../../components/onboarding/family-checklist";
import { PageHeader } from "../../components/page-header";
import { load, serverApi } from "../../lib/api-server";
import { getSpaces } from "../../lib/spaces";

export default async function Page() {
  const t = await getTranslations("guardian.home");
  const api = await serverApi();
  const [{ children }, { session }] = await Promise.all([
    load(api.parent.children.$get()),
    getSpaces(),
  ]);
  const manager = session.organizations.some(
    (o) => o.kind === "family" && o.permissions.includes("members.manage"),
  );
  // Nom de l'établissement de l'enfant, s'il est connu (la famille n'est pas nommée).
  const orgName = (id: string) => {
    const org = session.organizations.find((o) => o.id === id);
    return org && org.kind !== "family" ? org.name : undefined;
  };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <FamilyChecklist />
      {children.length === 0 ? (
        <EmptyState
          icon={<UsersThree weight="bold" />}
          tone="yellow"
          titleAs="h2"
          title={t("emptyTitle")}
          illustration="laptop"
          description={t(manager ? "emptyManager" : "empty")}
          action={
            manager ? (
              <Button asChild variant="brand">
                <Link href="/parent/famille">{t("addChild")}</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {children.map((child) => (
            <ChildCard
              key={child.learnerId}
              child={child}
              organizationName={orgName(child.organizationId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
