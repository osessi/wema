import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GuardianshipPanel } from "../../../components/guardian/guardianship-panel";
import { Section } from "../../../components/guardian/section";
import { PageHeader } from "../../../components/page-header";
import { AddMemberForm } from "../../../components/school/add-member-form";
import { MembersTable } from "../../../components/school/members-table";
import { load, serverApi } from "../../../lib/api-server";
import { getSpaces } from "../../../lib/spaces";

export default async function Page() {
  const t = await getTranslations("guardian.family");
  const { session } = await getSpaces();
  const families = session.organizations.filter(
    (o) => o.kind === "family" && o.permissions.includes("members.manage"),
  );
  if (families.length === 0) notFound();
  const api = await serverApi();
  const { children } = await load(api.parent.children.$get());

  const sections = await Promise.all(
    families.map(async (family) => {
      const org = api.admin.organizations[":id"];
      const [{ members }, { roles }] = await Promise.all([
        load(org.members.$get({ param: { id: family.id } })),
        load(org.roles.$get({ param: { id: family.id } })),
      ]);
      const own = family.permissions.map(String);
      const assignable = roles.filter((r) =>
        r.permissions.every((p) => own.includes(p)),
      );
      // Rôle proposé par défaut pour un enfant : celui qui ne gère pas la famille.
      const childRole = assignable.find(
        (r) => !r.permissions.some((p) => p === "members.manage"),
      );
      const links = children
        .filter((c) => c.organizationId === family.id)
        .map((c) => ({
          guardianId: session.user.id,
          learnerId: c.learnerId,
          label: t("linkLabel", {
            guardian: session.user.displayName,
            learner: c.displayName,
          }),
        }));
      return { family, members, assignable, childRole, links };
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {sections.map(({ family, members, assignable, childRole, links }) => (
        <div key={family.id} className="space-y-6">
          {sections.length > 1 && (
            <h2 className="font-display text-2xl font-bold">{family.name}</h2>
          )}
          <Section title={t("membersTitle")}>
            <MembersTable
              organizationId={family.id}
              members={members}
              roles={assignable}
              currentUserId={session.user.id}
            />
          </Section>
          <Section title={t("addTitle")} description={t("addText")}>
            <AddMemberForm
              organizationId={family.id}
              roles={assignable}
              defaultRoleId={childRole?.id}
              defaultKind="username"
            />
          </Section>
          <Section title={t("linksTitle")} description={t("linksText")}>
            <GuardianshipPanel
              organizationId={family.id}
              members={members}
              links={links}
            />
          </Section>
        </div>
      ))}
    </div>
  );
}
