import { PageHeader } from "@wema/ui";
import { getTranslations } from "next-intl/server";
import { load, serverApi } from "../../../lib/api-server";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const api = await serverApi();
  const { settings, defaults } = await load(api.admin.settings.pedagogy.$get());
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SettingsForm settings={settings} defaults={defaults} />
    </>
  );
}
