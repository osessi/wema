import { Badge } from "@wema/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { hasPermission } from "../../../lib/session";
import { EmptyState } from "../_ui/fields";
import { CountryForm } from "./country-form";

export default async function CurriculumPage() {
  const t = await getTranslations();
  const api = await serverApi();
  const { countries } = await load(api.admin.curriculum.countries.$get());
  const canWrite = await hasPermission("curriculum.write");
  return (
    <>
      <PageHeader
        title={t("curriculum.title")}
        description={t("curriculum.subtitle")}
      />
      <div className="flex flex-col gap-6">
        {countries.length === 0 ? (
          <EmptyState>{t("curriculum.noCountries")}</EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {countries.map((c) => (
              <Link
                key={c.id}
                href={`/admin/referentiel/${c.id}`}
                className="rounded-xl transition-colors hover:bg-muted/50"
              >
                <Card className="h-full bg-transparent">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="font-display text-lg">
                        {c.name}
                      </CardTitle>
                      <Badge variant={c.archived ? "outline" : "secondary"}>
                        {c.archived ? t("common.archived") : c.code}
                      </Badge>
                    </div>
                    <CardDescription>{c.unitLabel.plural}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
        {canWrite ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">
                {t("curriculum.newCountry")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CountryForm />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
