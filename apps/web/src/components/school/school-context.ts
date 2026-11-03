import "server-only";
import { notFound } from "next/navigation";
import { getSpaces } from "../../lib/spaces";

/** Organisation administrée par l'utilisateur, ou 404. */
export async function getSchool(orgId: string) {
  const { schools, session } = await getSpaces();
  const school = schools.find((s) => s.id === orgId);
  if (!school) notFound();
  const can = (p: string) => school.permissions.some((x) => x === p);
  return { school, session, can };
}
