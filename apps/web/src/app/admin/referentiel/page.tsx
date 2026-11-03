import { Badge, Card, EmptyState, PageHeader } from "@wema/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { load, serverApi } from "../../../lib/api-server";
import { hasPermission } from "../../../lib/session";
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
        subtitle={t("curriculum.subtitle")}
      />
      <div className="w-stack" style={{ gap: 20 }}>
        {countries.length === 0 ? (
          <EmptyState>{t("curriculum.noCountries")}</EmptyState>
        ) : (
          <div className="w-grid">
            {countries.map((c) => (
              <Link
                key={c.id}
                href={`/admin/referentiel/${c.id}`}
                className="w-card"
                style={{ color: "inherit" }}
              >
                <div
                  className="w-row"
                  style={{ justifyContent: "space-between" }}
                >
                  <h2 className="w-card__title">{c.name}</h2>
                  <Badge tone={c.archived ? "grey" : "blue"}>
                    {c.archived ? t("common.archived") : c.code}
                  </Badge>
                </div>
                <p className="w-muted" style={{ margin: 0 }}>
                  {c.unitLabel.plural}
                </p>
              </Link>
            ))}
          </div>
        )}
        {canWrite ? (
          <Card title={t("curriculum.newCountry")}>
            <CountryForm />
          </Card>
        ) : null}
      </div>
    </>
  );
}
