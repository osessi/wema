import "server-only";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import type { CardTone } from "@wema/ui/components/ui/card";
import { ClassCard } from "@wema/ui/components/wema/class-card";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { serverApi } from "../../lib/api-server";
import type { Overview } from "../../lib/school-types";
import { loadPrograms } from "./programs";
import { tryLoad } from "./try-load";

export interface SchoolClassCard {
  id: string;
  name: string;
  program: string | null;
  icon: string | null;
  learners: number;
  active: number;
  /** Part des notions validées, de 0 à 100, ou null sans programme ni élève. */
  mastered: number | null;
  students: { id: string; name: string }[];
}

/**
 * Cartes des classes d'une organisation : chiffres de la vue d'ensemble,
 * programme et matière du référentiel, élèves inscrits (si on gère les classes).
 */
export async function loadClassCards(
  orgId: string,
  overview: Overview,
  manage: boolean,
): Promise<SchoolClassCard[]> {
  const api = await serverApi();
  const [list, programs] = await Promise.all([
    manage
      ? tryLoad(
          api.admin.organizations[":id"].classes.$get({
            param: { id: orgId },
          }),
        )
      : null,
    manage ? loadPrograms() : [],
  ]);
  const byProgram = new Map(programs.map((p) => [p.id, p]));
  const classes = new Map((list?.classes ?? []).map((k) => [k.id, k]));
  const details = await Promise.all(
    overview.map((k) =>
      manage
        ? tryLoad(api.admin.classes[":id"].$get({ param: { id: k.classId } }))
        : null,
    ),
  );
  return overview
    .filter((k) => !classes.get(k.classId)?.archived)
    .map((k) => {
      const programId = classes.get(k.classId)?.programId ?? null;
      const program = programId ? byProgram.get(programId) : undefined;
      const detail = details.find((d) => d?.class.id === k.classId);
      return {
        id: k.classId,
        name: k.name,
        program: program?.label ?? null,
        icon: program?.icon ?? null,
        learners: k.learners,
        active: k.activeThisWeek,
        mastered:
          k.masteredShare === null ? null : Math.round(k.masteredShare * 100),
        students: (detail?.members ?? [])
          .filter((m) => m.role === "learner")
          .map((m) => ({ id: m.userId, name: m.displayName })),
      };
    });
}

/** Ton de coque d'une classe : dérivé de son identifiant, stable partout. */
const TONES: readonly CardTone[] = ["sky", "mint", "brand", "amber", "rose"];
function toneOf(id: string): CardTone {
  let h = 0;
  for (const c of id) h = (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0;
  return TONES[h % TONES.length] ?? "sky";
}

/** Grille de cartes de classe, chacune menant à sa fiche si on gère les classes. */
export async function ClassCardGrid({
  orgId,
  classes,
  manage,
  titleAs = "h2",
}: {
  orgId: string;
  classes: SchoolClassCard[];
  manage: boolean;
  titleAs?: "h2" | "h3";
}) {
  const t = await getTranslations("school.classes");
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {classes.map((k) => {
        const card = (
          <ClassCard
            titleAs={titleAs}
            tone={toneOf(k.id)}
            title={k.name}
            subtitle={k.program ?? t("noProgram")}
            media={<SubjectIcon icon={k.icon} size={44} />}
            progress={k.mastered ?? 0}
            progressLabel={t("masteredLabel", { name: k.name })}
            stats={[
              { label: t("statLearners"), value: k.learners },
              { label: t("statActive"), value: k.active },
            ]}
            students={k.students}
            studentsLabel={
              k.students.length > 0
                ? t("learners", { count: k.students.length })
                : undefined
            }
            action={
              manage ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors group-hover/class:text-foreground">
                  {t("open")}
                  <ArrowRight
                    aria-hidden
                    className="size-4 transition-transform group-hover/class:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
              ) : undefined
            }
          />
        );
        return (
          <li key={k.id} className="h-full">
            {manage ? (
              <Link
                href={`/ecole/${orgId}/classes/${k.id}`}
                className="block h-full rounded-[20px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {card}
              </Link>
            ) : (
              card
            )}
          </li>
        );
      })}
    </ul>
  );
}
