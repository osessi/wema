import { Books } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { hasPermission } from "../../../lib/session";
import { Panel } from "../_ui/kit";
import { SubjectCreateForm, SubjectList } from "./subject-list";

export default async function SubjectsPage() {
  const t = await getTranslations("subjects");
  const api = await serverApi();
  const { subjects } = await load(api.admin.curriculum.subjects.$get());
  const canWrite = await hasPermission("curriculum.write");
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Panel
        icon={<Books weight="fill" />}
        tone="sky"
        title={t("listTitle")}
        description={t("listHint")}
      >
        <SubjectList subjects={subjects} canWrite={canWrite} />
      </Panel>
      {canWrite ? <SubjectCreateForm /> : null}
    </>
  );
}
