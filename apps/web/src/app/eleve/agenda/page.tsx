import { getTranslations } from "next-intl/server";
import { FamilyAgenda } from "../../../components/agenda/family-agenda";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";

export default async function Page() {
  const t = await getTranslations("agenda");
  const api = await serverApi();
  const data = await load(
    api.agenda.family.$get({ query: { space: "learner" } }),
  );
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle.learner")} />
      <FamilyAgenda space="learner" data={data} stamp={Date.now()} />
    </div>
  );
}
