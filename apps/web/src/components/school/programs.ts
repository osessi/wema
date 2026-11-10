import "server-only";
import { serverApi } from "../../lib/api-server";
import type { ProgramOption } from "../../lib/school-types";
import { tryLoad } from "./try-load";

/** Programme avec l'icône de sa matière (clé du référentiel, ou null). */
export interface SchoolProgram extends ProgramOption {
  icon: string | null;
}

/** Programmes du référentiel (tous pays), pour choisir celui d'une classe. */
export async function loadPrograms(): Promise<SchoolProgram[]> {
  const api = await serverApi();
  const curriculum = api.admin.curriculum;
  const list = await tryLoad(curriculum.countries.$get());
  if (!list) return [];
  const { countries } = list;
  const options: SchoolProgram[] = [];
  for (const country of countries.filter((c) => !c.archived)) {
    const data = await tryLoad(
      curriculum.countries[":id"].curriculum.$get({
        param: { id: country.id },
      }),
    );
    if (!data) continue;
    const grades = new Map(data.grades.map((g) => [g.id, g]));
    const subjects = new Map(data.subjects.map((s) => [s.id, s]));
    const programs = data.programs
      .filter((p) => !p.archived)
      .map((p) => ({
        id: p.id,
        grade: grades.get(p.gradeId),
        subject: subjects.get(p.subjectId),
      }))
      .sort(
        (a, b) =>
          (a.grade?.position ?? 0) - (b.grade?.position ?? 0) ||
          (a.subject?.name ?? "").localeCompare(b.subject?.name ?? ""),
      );
    for (const p of programs)
      options.push({
        id: p.id,
        label: [country.name, p.grade?.name, p.subject?.name]
          .filter(Boolean)
          .join(" · "),
        icon: p.subject?.icon ?? null,
      });
  }
  return options;
}
