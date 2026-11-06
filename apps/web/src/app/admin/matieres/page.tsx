import { Card, CardContent } from "@wema/ui/components/ui/card";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { hasPermission } from "../../../lib/session";
import { SubjectList } from "./subject-list";

export default async function SubjectsPage() {
  const t = await getTranslations("subjects");
  const api = await serverApi();
  const { subjects } = await load(api.admin.curriculum.subjects.$get());
  const canWrite = await hasPermission("curriculum.write");
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Card>
        <CardContent>
          <SubjectList subjects={subjects} canWrite={canWrite} />
        </CardContent>
      </Card>
    </>
  );
}
