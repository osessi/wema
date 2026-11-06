import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage, legalInfo } from "../../components/legal/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.pages.privacy");
  return { title: t("title") };
}

export default async function Page() {
  const t = await getTranslations("legal.pages.privacy.retention");
  const info = await legalInfo();
  const r = info?.retention;
  return (
    <LegalPage page="privacy" version={info?.privacyVersion}>
      {r ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">{t("title")}</h2>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed">
            <li>{t("items.deletion", { days: r.deletionGraceDays })}</li>
            <li>{t("items.inactive", { days: r.inactiveAccountDays })}</li>
            <li>
              {r.tutorConversationDays === null
                ? t("items.tutorKept")
                : t("items.tutorDays", { days: r.tutorConversationDays })}
            </li>
            <li>{t("items.aiCalls", { days: r.aiCallDays })}</li>
            <li>{t("items.deliveries", { days: r.deliveryLogDays })}</li>
            <li>{t("items.codes", { days: r.oneTimeCodeDays })}</li>
            <li>{t("items.sessions")}</li>
          </ul>
        </section>
      ) : null}
    </LegalPage>
  );
}
