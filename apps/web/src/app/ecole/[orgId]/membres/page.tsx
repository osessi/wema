import { ShieldCheck, UserPlus, Users } from "@phosphor-icons/react/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MissingConsents } from "../../../../components/legal/missing-consents";
import { PageHeader } from "../../../../components/page-header";
import { AddMemberForm } from "../../../../components/school/add-member-form";
import { MembersTable } from "../../../../components/school/members-table";
import { RolesPanel } from "../../../../components/school/roles-panel";
import { getSchool } from "../../../../components/school/school-context";
import { SectionTitle } from "../../../../components/school/section-title";
import { load, serverApi } from "../../../../lib/api-server";

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { school, session, can } = await getSchool(orgId);
  if (!can("members.manage")) notFound();
  const t = await getTranslations("school.members");
  const api = await serverApi();
  const org = api.admin.organizations[":id"];
  const [{ members }, { roles }] = await Promise.all([
    load(org.members.$get({ param: { id: orgId } })),
    load(org.roles.$get({ param: { id: orgId } })),
  ]);
  // On n'attribue que des rôles dont on détient soi-même toutes les permissions.
  const own = school.permissions.map(String);
  const assignable = roles.filter((r) =>
    r.permissions.every((p) => own.includes(p)),
  );

  const memberCounts: Record<string, number> = {};
  for (const m of members)
    for (const r of m.roles) memberCounts[r.id] = (memberCounts[r.id] ?? 0) + 1;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle", { name: school.name })}
        actions={
          <Badge variant="info" className="tabular-nums">
            {t("count", { count: members.length })}
          </Badge>
        }
      />
      <MissingConsents organizationId={orgId} />
      <section className="space-y-4">
        <SectionTitle
          title={t("listTitle")}
          icon={<Users weight="fill" />}
          tone="sky"
        />
        <MembersTable
          organizationId={orgId}
          members={members}
          roles={assignable}
          currentUserId={session.user.id}
        />
      </section>
      <section className="space-y-5 rounded-card border bg-card p-4 shadow-xs sm:p-6">
        <SectionTitle
          title={t("addTitle")}
          description={t("addText")}
          icon={<UserPlus weight="fill" />}
          tone="yellow"
        />
        <AddMemberForm organizationId={orgId} roles={assignable} />
      </section>
      <section className="space-y-5 rounded-card border bg-card p-4 shadow-xs sm:p-6">
        <SectionTitle
          title={t("rolesTitle")}
          description={t("rolesText")}
          icon={<ShieldCheck weight="fill" />}
          tone="slate"
        />
        <RolesPanel
          organizationId={orgId}
          roles={roles}
          ownPermissions={own}
          canManage={can("roles.manage")}
          memberCounts={memberCounts}
        />
      </section>
    </div>
  );
}
