import "server-only";
import { cache } from "react";
import { load, serverApi } from "./api-server";
import { visibleSections } from "./nav";
import { getSession } from "./session";

/** Les espaces de l'interface, un par rôle. */
export type SpaceKey = "learner" | "teacher" | "guardian" | "school" | "admin";

export const SPACE_HREF: Record<SpaceKey, string> = {
  learner: "/eleve",
  teacher: "/prof",
  guardian: "/parent",
  school: "/ecole",
  admin: "/admin",
};

/** Ce que l'utilisateur connecté peut ouvrir, lu une fois par requête. */
export const getSpaces = cache(async () => {
  const [session, api] = await Promise.all([getSession(), serverApi()]);
  const mine = await load(api.me.spaces.$get());
  const orgs = session.organizations;
  /** Organisations (école, réseau de profs) que l'utilisateur administre. */
  const schools = orgs.filter(
    (o) =>
      o.kind !== "platform" &&
      o.kind !== "family" &&
      (o.permissions.includes("members.manage") ||
        o.permissions.includes("classes.manage")),
  );
  /** Organisations où il peut préparer des exercices pour ses élèves. */
  const teaches = orgs.filter(
    (o) => o.kind !== "platform" && o.permissions.includes("exercises.write"),
  );
  // Le back-office est l'outil de l'équipe Wema : il n'apparaît qu'avec des
  // permissions de plateforme. Un élève (référentiel en lecture) ou une
  // direction (qui a l'espace École) n'y sont pas envoyés.
  const admin =
    session.permissions.length > 0 && visibleSections(session).length > 0;
  const teacher = mine.teaching.length > 0 || teaches.length > 0;
  const guardian = mine.children.length > 0;
  // Un compte élève n'a en général ni classe à enseigner, ni enfant, ni
  // organisation à gérer ; il peut aussi être inscrit dans une classe.
  const learner =
    mine.learning.length > 0 ||
    (!teacher && !guardian && schools.length === 0 && !admin);
  const keys: SpaceKey[] = [];
  if (learner) keys.push("learner");
  if (teacher) keys.push("teacher");
  if (guardian) keys.push("guardian");
  if (schools.length > 0) keys.push("school");
  if (admin) keys.push("admin");
  return { session, keys, mine, schools, teaches };
});
