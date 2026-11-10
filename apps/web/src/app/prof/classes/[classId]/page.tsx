import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@wema/ui/components/ui/breadcrumb";
import { PersonStack } from "@wema/ui/components/wema/person-avatar";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../components/page-header";
import { AssignmentsPanel } from "../../../../components/teacher/assignments-panel";
import { ClassMapView } from "../../../../components/teacher/class-map";
import { ClassTabs } from "../../../../components/teacher/class-tabs";
import {
  isSuccess,
  notionIndex,
  programInfo,
} from "../../../../components/teacher/data";
import { LearnersTable } from "../../../../components/teacher/learners-table";
import { load, serverApi } from "../../../../lib/api-server";
import type { ExerciseList } from "../../../../lib/teacher-types";

const TABS = ["map", "learners", "assignments"] as const;
type Tab = (typeof TABS)[number];
const isTab = (v: string | undefined): v is Tab => TABS.some((t) => t === v);

export default async function ClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ classId }, { tab }] = await Promise.all([params, searchParams]);
  const t = await getTranslations("teacher.class");
  const api = await serverApi();
  const detailRes = await api.admin.classes[":id"].$get({
    param: { id: classId },
  });
  if (detailRes.status === 404 || detailRes.status === 403) notFound();
  const detail = await load(Promise.resolve(detailRes));
  const [map, { assignments }, notions] = await Promise.all([
    load(api.admin.classes[":id"].map.$get({ param: { id: classId } })),
    load(api.admin.classes[":id"].assignments.$get({ param: { id: classId } })),
    notionIndex(),
  ]);
  const orgId = detail.class.organizationId;
  const subjectIcon = map.class.programId
    ? ((await programInfo()).get(map.class.programId)?.icon ?? null)
    : null;
  // La lecture des exercices peut être refusée : la liste reste alors vide.
  const exercisesRes = await api.admin.organizations[":id"].exercises.$get({
    param: { id: orgId },
    query: { status: "validated" },
  });
  const exercises: ExerciseList = isSuccess(exercisesRes)
    ? (await exercisesRes.json()).exercises
    : [];

  const learners = detail.members.filter((m) => m.role === "learner");
  const classNotions = new Set<string>(map.notions.map((n) => n.notionId));
  const edges = map.notions.flatMap((n) =>
    (notions.get(n.notionId)?.prerequisites ?? [])
      .filter((p) => classNotions.has(p))
      .map((p) => ({ from: p, to: n.notionId })),
  );

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/prof">{t("breadcrumb")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{detail.class.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        title={detail.class.name}
        description={t("description", {
          learners: learners.length,
          notions: map.notions.length,
        })}
        actions={
          <div className="flex items-center gap-3">
            {learners.length > 0 ? (
              <PersonStack
                people={learners.map((m) => ({
                  id: m.userId,
                  name: m.displayName,
                }))}
                max={6}
                size="default"
              />
            ) : null}
            <SubjectIcon icon={subjectIcon} size={44} />
          </div>
        }
      />
      <ClassTabs
        initial={isTab(tab) ? tab : "map"}
        map={<ClassMapView map={map} edges={edges} orgId={orgId} />}
        learners={<LearnersTable map={map} orgId={orgId} />}
        assignments={
          <AssignmentsPanel
            classId={classId}
            learnerCount={learners.length}
            assignments={assignments}
            exercises={exercises.map((x) => {
              const n = notions.get(x.notionId);
              const inClass = classNotions.has(x.notionId);
              return {
                id: x.id,
                objective: x.objective,
                notionId: x.notionId,
                notionName: n
                  ? inClass
                    ? n.name
                    : `${n.name} · ${n.countryName} · ${n.programLabel}`
                  : null,
                inClass,
              };
            })}
          />
        }
      />
    </>
  );
}
