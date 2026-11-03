import { getTranslations } from "next-intl/server";
import { TeacherAgenda } from "../../../components/agenda/teacher-agenda";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";

export default async function Page() {
  const t = await getTranslations("agenda");
  const api = await serverApi();
  const data = await load(api.agenda.teacher.$get());
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle.teacher")} />
      <TeacherAgenda data={data} stamp={Date.now()} />
    </div>
  );
}
