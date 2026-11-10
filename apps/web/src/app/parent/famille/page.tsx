import {
  BookOpenText,
  LinkSimple,
  UserPlus,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AddChildForm } from "../../../components/guardian/add-child-form";
import { ChildPrograms } from "../../../components/guardian/child-programs";
import { GuardianshipPanel } from "../../../components/guardian/guardianship-panel";
import { Section } from "../../../components/guardian/section";
import { PageHeader } from "../../../components/page-header";
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
  const [{ children }, overview] = await Promise.all([
    load(api.parent.children.$get()),
    load(api.family.$get()),
  ]);
  const tFamily = await getTranslations("family");

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
      // Parents possibles : les membres dont un rôle gère la famille.
      const guardianRoles = new Set(
        roles
          .filter((r) => r.permissions.some((p) => p === "members.manage"))
          .map((r) => r.id),
      );
      const guardians = members
        .filter((m) => m.roles.some((r) => guardianRoles.has(r.id)))
        .map((m) => m.userId);
      return { family, members, assignable, links, guardians };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {sections.map(({ family, members, assignable, links, guardians }) => {
        const kids = overview.children.filter(
          (c) => c.organizationId === family.id,
        );
        return (
          <div key={family.id} className="flex flex-col gap-6">
            {sections.length > 1 && (
              <h2 className="text-2xl font-light tracking-tight">
                {family.name}
              </h2>
            )}
            <Section
              eyebrow={t("eyebrowMembers")}
              icon={<UsersThree weight="bold" />}
              tone="yellow"
              title={t("membersTitle")}
            >
              <MembersTable
                organizationId={family.id}
                members={members}
                roles={assignable}
                currentUserId={session.user.id}
              />
            </Section>
            <div className="flex flex-col gap-6">
              <Section
                eyebrow={t("eyebrowPrograms")}
                icon={<BookOpenText weight="bold" />}
                tone="sky"
                title={tFamily("children.title")}
              >
                {kids.length === 0 ? (
                  <p className="rounded-[10px] border border-dashed px-4 py-3 text-center text-sm text-muted-foreground">
                    {tFamily("children.empty")}
                  </p>
                ) : (
                  <ul className="divide-y overflow-hidden rounded-card border bg-background/60">
                    {kids.map((c) => (
                      <ChildPrograms
                        key={c.learnerId}
                        familyId={family.id}
                        child={c}
                        catalog={overview.catalog}
                      />
                    ))}
                  </ul>
                )}
              </Section>
              <Section
                eyebrow={t("eyebrowAdd")}
                icon={<UserPlus weight="bold" />}
                tone="mint"
                title={tFamily("child.title")}
                description={tFamily("child.description")}
              >
                <AddChildForm familyId={family.id} catalog={overview.catalog} />
              </Section>
            </div>
            <Section
              eyebrow={t("eyebrowLinks")}
              icon={<LinkSimple weight="bold" />}
              tone="slate"
              title={t("linksTitle")}
              description={t("linksText")}
            >
              <GuardianshipPanel
                organizationId={family.id}
                members={members}
                guardians={guardians}
                links={links}
              />
            </Section>
          </div>
        );
      })}
    </div>
  );
}
