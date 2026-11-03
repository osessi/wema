import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { legalInfo } from "../../../components/legal/legal-page";
import { getSession } from "../../../lib/session";
import { AuthCard } from "../../connexion/auth-card";
import { AcceptForm } from "./accept-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.accept");
  return { title: t("title") };
}

/** Acceptation des conditions à la première connexion après un changement de version. */
export default async function AcceptTermsPage() {
  await getSession();
  const t = await getTranslations("legal.accept");
  const info = await legalInfo();
  if (!info) throw new Error("versions des conditions indisponibles");
  return (
    <AuthCard title={t("title")} description={t("body")} footer={null}>
      <AcceptForm
        termsVersion={info.termsVersion}
        privacyVersion={info.privacyVersion}
      />
    </AuthCard>
  );
}
