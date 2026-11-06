import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { serverApi } from "../../lib/api-server";
import { AuthCard } from "./auth-card";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const t = await getTranslations("auth");
  const api = await serverApi();
  const providers = await api.auth.providers
    .$get()
    .then((r) => r.json())
    .catch(() => ({ google: false, apple: false }));
  const { erreur } = await searchParams;
  return (
    <AuthCard
      title={t("title")}
      description={t("subtitle")}
      footer={
        <span>
          {t("noAccount")}{" "}
          <Link
            href="/inscription"
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t("toRegister")}
          </Link>
        </span>
      }
    >
      <LoginForm providers={providers} oauthError={erreur === "oauth"} />
    </AuthCard>
  );
}
