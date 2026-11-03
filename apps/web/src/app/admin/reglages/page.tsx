import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { PrivacyForm } from "./privacy-form";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const api = await serverApi();
  const { settings, defaults } = await load(api.admin.settings.pedagogy.$get());
  const privacy = await load(api.admin.privacy.settings.$get());
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SettingsForm settings={settings} defaults={defaults} />
      <PrivacyForm settings={privacy.settings} />
    </>
  );
}
