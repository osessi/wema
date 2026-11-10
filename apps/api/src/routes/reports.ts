import { zValidator } from "@hono/zod-validator";
import { createClassStore, createCurriculumStore } from "@wema/db";
import { asLearnerId } from "@wema/domain";
import { buildProgressReport, type ProgressReport } from "@wema/learner-model";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { allowed, fail, requireSession } from "../http";
import { learnerModels } from "./exercises";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Période la plus longue d'un rapport. */
const MAX_DAYS = 2 * 366;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Période demandée, par défaut les 3 derniers mois (jours entiers, UTC). */
export function reportPeriod(
  query: { from?: string | undefined; to?: string | undefined },
  now: Date,
): { from: Date; to: Date } | null {
  const toDay = query.to ?? now.toISOString().slice(0, 10);
  const to = new Date(`${toDay}T23:59:59.999Z`);
  let from: Date;
  if (query.from) from = new Date(`${query.from}T00:00:00.000Z`);
  else {
    from = new Date(`${toDay}T00:00:00.000Z`);
    from.setUTCMonth(from.getUTCMonth() - 3);
  }
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  if (from > to || to.getTime() - from.getTime() > MAX_DAYS * DAY_MS)
    return null;
  return { from, to };
}

const csvCell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Rapport en CSV (séparateur « ; », lisible par un tableur français). */
export function reportCsv(
  meta: { className: string; program: string | null },
  r: ProgressReport,
): string {
  const pct = (v: number | null) => (v === null ? null : Math.round(v * 100));
  const rows: (string | number | null)[][] = [
    ["Rapport de progression"],
    ["Classe", meta.className],
    ["Programme", meta.program],
    ["Du", r.from.toISOString().slice(0, 10)],
    ["Au", r.to.toISOString().slice(0, 10)],
    [],
    ["Indicateur", "Début", "Fin"],
    ["Élèves inscrits", r.learners.enrolled, r.learners.enrolled],
    ["Élèves actifs sur la période", null, r.learners.active],
    ["Notions validées (élève × notion)", r.validated.start, r.validated.end],
    [
      "Notions validées par au moins un élève",
      r.validated.notionsStart,
      r.validated.notionsEnd,
    ],
    [
      "Maîtrise moyenne des notions travaillées (%)",
      pct(r.mastery.start),
      pct(r.mastery.end),
    ],
    ["Non vues", r.statuses.start.not_seen, r.statuses.end.not_seen],
    ["À travailler", r.statuses.start.needs_work, r.statuses.end.needs_work],
    ["En cours", r.statuses.start.in_progress, r.statuses.end.in_progress],
    ["Validées", r.statuses.start.mastered, r.statuses.end.mastered],
    [],
    ["Activité", "Valeur"],
    ["Minutes d'activité", r.activity.minutes],
    ["Séances", r.activity.sessions],
    ["Jours actifs", r.activity.activeDays],
    ["Événements du journal", r.activity.events],
    [],
    ["Notion la plus travaillée", "Code", "Réponses", "Justes", "Élèves"],
    ...r.topNotions.map((n) => [
      n.name,
      n.code,
      n.answers,
      n.correct,
      n.learners,
    ]),
    [],
    [
      "Idée fausse",
      "Notion",
      "Occurrences sur la période",
      "Élèves au début",
      "Élèves à la fin",
    ],
    ...r.misconceptions.map((m) => [
      m.description,
      m.notionName,
      m.occurrences,
      m.learnersStart,
      m.learnersEnd,
    ]),
  ];
  return `﻿${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

/**
 * Rapport de progression d'une classe (pilote d'école ou de prof
 * particulier) : la direction qui gère les classes, ou un prof de la classe.
 */
export function reportRoutes(deps: Deps) {
  const classes = createClassStore(deps.db);
  const curriculum = createCurriculumStore(deps.db);

  const build = async (
    c: Context<Env>,
    classId: string,
    query: { from?: string | undefined; to?: string | undefined },
  ) => {
    const k = await classes.getClass(classId);
    if (!k) return { kind: "not_found" as const };
    if (
      !allowed(c, "classes.manage", k.organizationId) &&
      !(await classes.isTeacherOf(k.id, c.get("user").id))
    )
      return { kind: "forbidden" as const };
    const period = reportPeriod(query, deps.now());
    if (!period) return { kind: "invalid_period" as const };
    const country = k.programId
      ? await curriculum.countryOfProgram(k.programId)
      : null;
    const rows = country ? await curriculum.loadCountry(country) : null;
    const program = rows?.programs.find((p) => p.id === k.programId) ?? null;
    const unitIds = new Set(
      (rows?.units ?? [])
        .filter((u) => u.programId === k.programId && !u.archived)
        .map((u) => u.id),
    );
    const notions = (rows?.notions ?? [])
      .filter((n) => unitIds.has(n.unitId) && !n.archived)
      .map((n) => ({
        id: n.id,
        code: n.code,
        name: n.name,
        misconceptions: n.misconceptions
          .filter((m) => !m.archived)
          .map((m) => ({ id: m.id, description: m.description })),
      }));
    const learnerIds = (await classes.listMembers(k.id))
      .filter((m) => m.role === "learner")
      .map((m) => asLearnerId(m.userId));
    const models = await learnerModels(deps.db, learnerIds);
    const settings = models.values().next().value?.settings;
    const report = buildProgressReport({
      learners: learnerIds.map((learnerId) => ({
        learnerId,
        events: models.get(learnerId)?.events ?? [],
      })),
      notions,
      ...period,
      ...(settings ? { settings } : {}),
    });
    const programLabel =
      rows && program
        ? [
            rows.country.name,
            rows.grades.find((g) => g.id === program.gradeId)?.name,
            rows.subjects.find((s) => s.id === program.subjectId)?.name,
          ]
            .filter(Boolean)
            .join(" · ")
        : null;
    return {
      kind: "ok" as const,
      meta: {
        classId: k.id,
        organizationId: k.organizationId,
        className: k.name,
        program: programLabel,
      },
      report,
    };
  };

  const query = zValidator(
    "query",
    z.object({ from: day.optional(), to: day.optional() }),
  );
  const param = zValidator("param", z.object({ id: z.uuid() }));

  return new Hono<Env>()
    .use(requireSession(deps))
    .get("/classes/:id", param, query, async (c) => {
      const r = await build(c, c.req.valid("param").id, c.req.valid("query"));
      if (r.kind === "not_found") return fail(c, 404, "not_found");
      if (r.kind === "forbidden") return fail(c, 403, "forbidden");
      if (r.kind === "invalid_period") return fail(c, 422, "invalid_period");
      return c.json({ ...r.meta, report: r.report }, 200);
    })
    .get("/classes/:id/csv", param, query, async (c) => {
      const r = await build(c, c.req.valid("param").id, c.req.valid("query"));
      if (r.kind === "not_found") return fail(c, 404, "not_found");
      if (r.kind === "forbidden") return fail(c, 403, "forbidden");
      if (r.kind === "invalid_period") return fail(c, 422, "invalid_period");
      const range = `${r.report.from.toISOString().slice(0, 10)}_${r.report.to.toISOString().slice(0, 10)}`;
      c.header(
        "content-disposition",
        `attachment; filename="rapport-${range}.csv"`,
      );
      return c.body(reportCsv(r.meta, r.report), 200, {
        "content-type": "text/csv; charset=utf-8",
      });
    });
}
