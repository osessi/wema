import { ListChecks } from "@phosphor-icons/react/dist/ssr";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { AuditLog } from "./audit-log";

export default async function AuditPage() {
  const t = await getTranslations("audit");
  const api = await serverApi();
  const { entries } = await load(api.admin.audit.$get({ query: {} }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {entries.length === 0 ? (
        <EmptyState
          icon={<ListChecks weight="bold" />}
          title={t("none")}
          titleAs="h2"
        />
      ) : (
        <AuditLog entries={entries} />
      )}
    </>
  );
}
