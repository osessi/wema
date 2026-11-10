import {
  ShieldCheck,
  Student,
  UserPlus,
  Users,
} from "@phosphor-icons/react/ssr";
import { GlowTile } from "@wema/ui/components/brand/glow-tile";
import { Badge } from "@wema/ui/components/ui/badge";
import { CardShell } from "@wema/ui/components/ui/card";
import { FieldSection } from "@wema/ui/components/ui/field";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MissingConsents } from "../../../../components/legal/missing-consents";
import { PageHeader } from "../../../../components/page-header";
import { AddMemberForm } from "../../../../components/school/add-member-form";
import { MembersTable } from "../../../../components/school/members-table";
import { RolesPanel } from "../../../../components/school/roles-panel";
import { getSchool } from "../../../../components/school/school-context";
import { SectionTitle } from "../../../../components/school/section-title";
import { RosterImport } from "../../../../components/tutoring/roster-import";
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
  const [{ members }, { roles }, { classes }] = await Promise.all([
    load(org.members.$get({ param: { id: orgId } })),
    load(org.roles.$get({ param: { id: orgId } })),
    load(org.classes.$get({ param: { id: orgId } })),
  ]);
  const tRoster = await getTranslations("tutoring.roster");
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
        <CardShell tone="sky">
          <MembersTable
            organizationId={orgId}
            members={members}
            roles={assignable}
            currentUserId={session.user.id}
          />
        </CardShell>
      </section>
      <FieldSection
        tone="mint"
        title={<h2 className="text-base font-semibold">{tRoster("title")}</h2>}
        description={tRoster("pasteHint", { max: 100 })}
        icon={
          <GlowTile tone="mint" size={36}>
            <Student weight="fill" />
          </GlowTile>
        }
      >
        <RosterImport
          organizationId={orgId}
          classes={classes
            .filter((k) => !k.archived)
            .map((k) => ({ id: k.id, name: k.name }))}
          defaultClassId={null}
          canEnroll={can("classes.manage")}
        />
      </FieldSection>
      <FieldSection
        tone="brand"
        title={<h2 className="text-base font-semibold">{t("addTitle")}</h2>}
        description={t("addText")}
        icon={
          <GlowTile tone="yellow" size={36}>
            <UserPlus weight="fill" />
          </GlowTile>
        }
      >
        <AddMemberForm organizationId={orgId} roles={assignable} />
      </FieldSection>
      <section className="space-y-4">
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
