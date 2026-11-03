import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../components/page-header";
import { AddMemberForm } from "../../../../components/school/add-member-form";
import { MembersTable } from "../../../../components/school/members-table";
import { RolesPanel } from "../../../../components/school/roles-panel";
import { getSchool } from "../../../../components/school/school-context";
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

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={school.name} />
      <section className="space-y-4">
        <MembersTable
          organizationId={orgId}
          members={members}
          roles={assignable}
          currentUserId={session.user.id}
        />
      </section>
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-display text-xl font-bold">{t("addTitle")}</h2>
        <AddMemberForm organizationId={orgId} roles={assignable} />
      </section>
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-bold">{t("rolesTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("rolesText")}</p>
        </div>
        <RolesPanel
          organizationId={orgId}
          roles={roles}
          ownPermissions={own}
          canManage={can("roles.manage")}
        />
      </section>
    </div>
  );
}
