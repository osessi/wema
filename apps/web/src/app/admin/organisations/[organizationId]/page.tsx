import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { GlowTile } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../components/page-header";
import { load, serverApi } from "../../../../lib/api-server";
import { getSession } from "../../../../lib/session";
import { KIND_LOOK } from "../kinds";
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

  const look = KIND_LOOK[organization.kind];
  return (
    <>
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/organisations"
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          {t("organizations.back")}
        </Link>
        <div className="flex items-start gap-4">
          <GlowTile
            tone={look.tone}
            size={56}
            className="mt-1 hidden sm:inline-grid"
          >
            <look.Icon weight="fill" />
          </GlowTile>
          <div className="min-w-0 flex-1 space-y-3">
            <PageHeader
              title={organization.name}
              eyebrow={t("organizations.title")}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={look.badge}>
                <look.Icon aria-hidden weight="fill" />
                {t(`organizations.kinds.${organization.kind}`)}
              </Badge>
              <Badge variant="neutral" className="tabular-nums">
                {t("organizations.rolesCount", { count: roles.length })}
              </Badge>
              {members ? (
                <Badge variant="neutral" className="tabular-nums">
                  {t("organizations.membersCount", { count: members.length })}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>
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
