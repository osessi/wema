import { PageHeader } from "@wema/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { load, serverApi } from "../../../../lib/api-server";
import { getSession } from "../../../../lib/session";
import { OrganizationTabs } from "./organization-tabs";

function isSuccess<R extends { ok: boolean }>(
  res: R,
): res is Extract<R, { ok: true }> {
  return res.ok;
}

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const t = await getTranslations();
  const api = await serverApi();
  const { organizations } = await load(api.admin.organizations.$get());
  const organization = organizations.find((o) => o.id === organizationId);
  if (!organization) notFound();

  // Permissions effectives ici : celles données dans cette organisation, plus
  // celles de l'équipe Wema, qui administre toutes les organisations.
  const session = await getSession();
  const permissions = new Set(
    session.organizations
      .filter((o) => o.id === organizationId || o.kind === "platform")
      .flatMap((o) => o.permissions),
  );

  // Ces deux lectures peuvent être refusées (403) : on affiche alors ce qui est permis.
  const [rolesRes, membersRes] = await Promise.all([
    api.admin.organizations[":id"].roles.$get({
      param: { id: organizationId },
    }),
    api.admin.organizations[":id"].members.$get({
      param: { id: organizationId },
    }),
  ]);
  const roles = isSuccess(rolesRes) ? (await rolesRes.json()).roles : [];
  const members = isSuccess(membersRes)
    ? (await membersRes.json()).members
    : null;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/admin/organisations">{t("organizations.title")}</Link>
        }
        title={organization.name}
        subtitle={t(`organizations.kinds.${organization.kind}`)}
      />
      <OrganizationTabs
        organizationId={organization.id}
        platform={organization.kind === "platform"}
        roles={roles}
        members={members}
        canManageRoles={rolesRes.ok && permissions.has("roles.manage")}
      />
    </>
  );
}
