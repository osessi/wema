import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "../connexion/auth-card";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const t = await getTranslations("auth");
  return (
    <AuthCard
      title={t("registerTitle")}
      description={t("registerSubtitle")}
      footer={
        <span>
          {t("hasAccount")}{" "}
          <Link
            href="/connexion"
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t("toLogin")}
          </Link>
        </span>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
