import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

/** Corps d'une réponse réussie d'une route du client typé. */
type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

type Api = ReturnType<typeof hc<AppType>>["api"]["agenda"];

/** Espace qui affiche l'agenda. */
export type AgendaSpace = "teacher" | "learner" | "guardian";

export type CalendarData = Ok<Api["calendar"]["$get"]>;
export type CalendarSession = CalendarData["sessions"][number] & {
  childNames?: string[];
};
export type CalendarAssignment = CalendarData["assignments"][number];
export type CalendarWindow = CalendarData["availability"][number];

export type TeacherData = Ok<Api["teacher"]["$get"]>;
export type Rule = TeacherData["rules"][number];
export type Group = TeacherData["groups"][number];
export type TeacherLearner = TeacherData["learners"][number];
export type Notion = TeacherData["notions"][number];
export type PendingSession = TeacherData["pending"][number];

export type FamilyData = Ok<Api["family"]["$get"]>;
export type BookableLink = FamilyData["bookable"][number];
export type UpcomingSession = FamilyData["upcoming"][number];

export type SessionDetail = Ok<Api["sessions"][":id"]["$get"]>;
export type SessionStatus = SessionDetail["session"]["status"];

/** Page de détail d'une séance, selon l'espace. */
export const SESSION_BASE: Record<AgendaSpace, string> = {
  teacher: "/prof/agenda",
  learner: "/eleve/agenda",
  guardian: "/parent/agenda",
};

export const sessionHref = (space: AgendaSpace, id: string) =>
  `${SESSION_BASE[space]}/seances/${id}`;
