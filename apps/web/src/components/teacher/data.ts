import "server-only";
import { cache } from "react";
import { load, serverApi } from "../../lib/api-server";
import { getSpaces } from "../../lib/spaces";
import type { NotionInfo } from "../../lib/teacher-types";

/** Réponse réussie d'une route (le corps est alors typé). */
export function isSuccess<R extends { ok: boolean }>(
  res: R,
): res is Extract<R, { ok: true }> {
  return res.ok;
}

/** Organisations où le prof prépare des exercices (exercises.write). */
export const teacherOrganizations = cache(async () => {
  const { teaches } = await getSpaces();
  return teaches.map((o) => ({ id: o.id, name: o.name }));
});

/** Organisation choisie (paramètre `org`), ou la première. */
export async function pickOrganization(requested: string | undefined) {
  const orgs = await teacherOrganizations();
  return orgs.find((o) => o.id === requested) ?? orgs[0] ?? null;
}

/**
 * Notions du référentiel, tous pays confondus, indexées par identifiant.
 * Lecture seule ; vide si le prof n'a pas le droit de lire le référentiel.
 */
export const notionIndex = cache(async () => {
  const api = await serverApi();
  const index = new Map<string, NotionInfo>();
  const countriesRes = await api.admin.curriculum.countries.$get();
  if (!isSuccess(countriesRes)) return index;
  const { countries } = await countriesRes.json();
  const curricula = await Promise.all(
    countries
      .filter((c) => !c.archived)
      .map(async (c) => {
        const res = await api.admin.curriculum.countries[":id"].curriculum.$get(
          { param: { id: c.id } },
        );
        return isSuccess(res) ? res.json() : null;
      }),
  );
  for (const cur of curricula) {
    if (!cur) continue;
    const grades = new Map(cur.grades.map((g) => [g.id, g.name]));
    const subjects = new Map(cur.subjects.map((s) => [s.id, s.name]));
    const programs = new Map(
      cur.programs.map((p) => [
        p.id,
        `${grades.get(p.gradeId) ?? ""} · ${subjects.get(p.subjectId) ?? ""}`,
      ]),
    );
    const units = new Map(cur.units.map((u) => [u.id, u]));
    for (const n of cur.notions) {
      if (n.archived) continue;
      const unit = units.get(n.unitId);
      if (!unit || unit.archived) continue;
      index.set(n.id, {
        id: n.id,
        name: n.name,
        countryId: cur.country.id,
        countryName: cur.country.name,
        programId: unit.programId,
        programLabel: programs.get(unit.programId) ?? "",
        unitName: unit.name,
        prerequisites: n.prerequisites,
        misconceptions: n.misconceptions
          .filter((m) => !m.archived)
          .map((m) => ({ id: m.id, description: m.description })),
      });
    }
  }
  return index;
});

/** Exercices visibles par l'organisation : les siens et ceux validés de Wema. */
export const organizationExercises = cache(async (organizationId: string) => {
  const api = await serverApi();
  const { exercises } = await load(
    api.admin.organizations[":id"].exercises.$get({
      param: { id: organizationId },
      query: {},
    }),
  );
  return exercises;
});

/** Lundi de la semaine d'une date, AAAA-MM-JJ (UTC). */
export function mondayOf(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

/** Décale une semaine (AAAA-MM-JJ) de `weeks` semaines. */
export function shiftWeek(week: string, weeks: number): string {
  const d = new Date(`${week}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export function isWeek(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(`${value}T00:00:00Z`).getUTCDay() === 1
  );
}
