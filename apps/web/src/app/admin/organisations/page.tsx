import { Badge, Card, EmptyState, PageHeader, Table } from "@wema/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { load, serverApi } from "../../../lib/api-server";
import { hasPermission } from "../../../lib/session";
import { OrganizationForm } from "./organization-form";

export default async function OrganizationsPage() {
  const t = await getTranslations();
  const api = await serverApi();
  const { organizations } = await load(api.admin.organizations.$get());
  const canCreate = await hasPermission("organizations.manage");
  return (
    <>
      <PageHeader
        title={t("organizations.title")}
        subtitle={t("organizations.subtitle")}
      />
      <div className="w-stack" style={{ gap: 20 }}>
        <Card>
          {organizations.length === 0 ? (
            <EmptyState>{t("organizations.none")}</EmptyState>
          ) : (
            <Table head={[t("common.name"), t("organizations.kind"), ""]}>
              {organizations.map((o) => (
                <tr key={o.id}>
                  <td>{o.name}</td>
                  <td>
                    <Badge tone={o.kind === "platform" ? "orange" : "blue"}>
                      {t(`organizations.kinds.${o.kind}`)}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      className="w-btn w-btn--secondary w-btn--sm"
                      href={`/admin/organisations/${o.id}`}
                    >
                      {t("common.open")}
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        {canCreate ? (
          <Card title={t("organizations.new")}>
            <OrganizationForm />
          </Card>
        ) : null}
      </div>
    </>
  );
}
