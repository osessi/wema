import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { RoutingForm } from "./routing-form";
import { UsageTable } from "./usage-table";

export default async function AiPage() {
  const t = await getTranslations("ai");
  const api = await serverApi();
  const [routing, usage] = await Promise.all([
    load(api.admin.ai.routing.$get()),
    load(api.admin.ai.usage.$get({ query: { groupBy: "task" } })),
  ]);
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <RoutingForm data={routing} />
      <UsageTable usage={usage} />
    </>
  );
}
