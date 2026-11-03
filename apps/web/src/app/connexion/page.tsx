import { Card } from "@wema/ui";
import { getTranslations } from "next-intl/server";
import { serverApi } from "../../lib/api-server";
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
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <Card title={t("title")} subtitle={t("subtitle")}>
          <LoginForm providers={providers} oauthError={erreur === "oauth"} />
        </Card>
      </div>
    </main>
  );
}
