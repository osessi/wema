import { getTranslations } from "next-intl/server";
import { ChildCard } from "../../components/guardian/child-card";
import { PageHeader } from "../../components/page-header";
import { load, serverApi } from "../../lib/api-server";

export default async function Page() {
  const t = await getTranslations("guardian.home");
  const api = await serverApi();
  const { children } = await load(api.parent.children.$get());
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {children.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">
          {t("empty")}
        </p>
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
