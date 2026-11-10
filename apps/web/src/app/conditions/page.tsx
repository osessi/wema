import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage, legalInfo } from "../../components/legal/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.pages.terms");
  return { title: t("title") };
}

export default async function Page() {
  const info = await legalInfo();
  return <LegalPage page="terms" version={info?.termsVersion} />;
}
