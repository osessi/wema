import { ArrowRight, ChartBar } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@wema/ui/components/ui/button";
import { StatTile } from "@wema/ui/components/wema/stat-tile";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { usdOptions } from "../_ui/days";
import { Panel } from "../_ui/kit";
import { RoutingForm } from "./routing-form";

export default async function AiPage() {
  const t = await getTranslations("ai");
  const api = await serverApi();
  const [routing, usage] = await Promise.all([
    load(api.admin.ai.routing.$get()),
    load(api.admin.ai.usage.$get({ query: { groupBy: "task" } })),
  ]);
  const calls = usage.rows.reduce((s, r) => s + r.calls, 0);
  const errors = usage.rows.reduce((s, r) => s + r.errors, 0);
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <RoutingForm data={routing} />
      {/* Le détail de la consommation est dans « Coûts de l'IA ». */}
      <Panel
        icon={<ChartBar weight="fill" />}
        tone="rose"
        title={t("usageTitle")}
        description={t("usageLink")}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/couts">
              {t("usageDetail")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3 [&>*]:h-full">
          <StatTile
            label={t("cost")}
            value={usage.totalCostUsd}
            format={usdOptions(usage.totalCostUsd)}
          />
          <StatTile label={t("calls")} value={calls} />
          <StatTile
            label={t("errors")}
            value={errors}
            hint={
              calls > 0
                ? t("errorRate", {
                    value: new Intl.NumberFormat("fr-FR", {
                      style: "percent",
                      maximumFractionDigits: 1,
                    }).format(errors / calls),
                  })
                : undefined
            }
          />
        </div>
      </Panel>
    </>
  );
}
