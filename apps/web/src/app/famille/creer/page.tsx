import { Button } from "@wema/ui/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { load, serverApi } from "../../../lib/api-server";
import { getSession } from "../../../lib/session";
import { AuthCard } from "../../connexion/auth-card";
import { CreateFamilyForm } from "./create-family-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("family.create");
  return { title: t("title") };
}

/** Parcours famille autonome : un parent inscrit seul crée sa famille (fiche 0010). */
export default async function CreateFamilyPage() {
  const session = await getSession();
  if (session.mustAcceptTerms) redirect("/compte/conditions");
  const t = await getTranslations("family.create");
  const api = await serverApi();
  const overview = await load(api.family.$get());
  if (overview.families.length > 0) redirect("/parent/famille");
  return (
    <AuthCard title={t("title")} description={t("description")} footer={null}>
      {overview.canCreate ? (
        <CreateFamilyForm defaultName={session.user.displayName} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("notAllowed")}</p>
          <Button asChild variant="outline">
            <Link href="/">{t("goFamily")}</Link>
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
