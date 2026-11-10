import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "../../components/legal/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.pages.cookies");
  return { title: t("title") };
}

export default function Page() {
  return <LegalPage page="cookies" />;
}
