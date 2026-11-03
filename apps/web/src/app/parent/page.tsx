import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../components/page-header";

export default async function Page() {
  const t = await getTranslations("guardian.home");
  return <PageHeader title={t("title")} />;
}
