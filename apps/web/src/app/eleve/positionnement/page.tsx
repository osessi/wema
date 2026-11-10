import { Path } from "@phosphor-icons/react/ssr";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { getFormatter, getTranslations } from "next-intl/server";
import { PlacementSubjects } from "../../../components/learner/placement-subjects";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";

/** Test de niveau : une entrée par matière suivie, avant le parcours. */
export default async function Page() {
  const t = await getTranslations("learner.placement");
  const format = await getFormatter();
  const api = await serverApi();
  const { subjects } = await load(api.learner.placement.$get());

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title={t("title")} description={t("introText")} />
      {subjects.length === 0 ? (
        <EmptyState
          icon={<Path weight="fill" />}
          tone="amber"
          title={t("noSubject")}
          titleAs="h2"
          description={t("noSubjectHint")}
        />
      ) : (
        <PlacementSubjects
          subjects={subjects.map((s) => ({
            subjectId: s.subjectId,
            subjectIcon: s.subjectIcon,
            programName: s.programName,
            state: s.state,
            hasQuestions: s.hasQuestions,
            doneOn: s.completedAt
              ? format.dateTime(new Date(s.completedAt), { dateStyle: "long" })
              : null,
          }))}
        />
      )}
    </div>
  );
}
