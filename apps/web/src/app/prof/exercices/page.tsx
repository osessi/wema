import { Books, Plus } from "@phosphor-icons/react/ssr";
import { Button } from "@wema/ui/components/ui/button";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import {
  mondayOf,
  notionIndex,
  organizationExercises,
  pickOrganization,
  teacherOrganizations,
} from "../../../components/teacher/data";
import { ExerciseLibrary } from "../../../components/teacher/exercise-library";
import { OrgSwitcher } from "../../../components/teacher/org-switcher";

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org: requested } = await searchParams;
  const t = await getTranslations("teacher.library");
  const org = await pickOrganization(requested);
  if (!org)
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState
          icon={<Books weight="fill" />}
          tone="yellow"
          title={t("title")}
          titleAs="h2"
          description={t("noOrganization")}
        />
      </>
    );
  const [exercises, notions, orgs] = await Promise.all([
    organizationExercises(org.id),
    notionIndex(),
    teacherOrganizations(),
  ]);
  const notionNames = Object.fromEntries(
    exercises.flatMap((x) => {
      const n = notions.get(x.notionId);
      return n
        ? [
            [
              x.notionId,
              { name: n.name, context: `${n.countryName} · ${n.programLabel}` },
            ],
          ]
        : [];
    }),
  );
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description", { org: org.name })}
        actions={
          <Button asChild>
            <Link href={`/prof/exercices/nouveau?org=${org.id}`}>
              <Plus />
              {t("create")}
            </Link>
          </Button>
        }
      />
      <OrgSwitcher
        orgs={orgs}
        current={org.id}
        href={(id) => `/prof/exercices?org=${id}`}
      />
      <ExerciseLibrary
        orgId={org.id}
        week={mondayOf(new Date())}
        exercises={exercises}
        notionNames={notionNames}
      />
    </>
  );
}
