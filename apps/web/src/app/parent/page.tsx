import { Button } from "@wema/ui/components/ui/button";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChildCard } from "../../components/guardian/child-card";
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
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {children.length === 0 ? (
        <div className="space-y-3 rounded-lg border bg-card p-6">
          <p className="text-muted-foreground">
            {t(manager ? "emptyManager" : "empty")}
          </p>
          {manager ? (
            <Button asChild>
              <Link href="/parent/famille">{t("addChild")}</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {children.map((child) => (
            <ChildCard key={child.learnerId} child={child} />
          ))}
        </div>
      )}
    </div>
  );
}
