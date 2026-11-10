import { load, serverApi } from "../../lib/api-server";
import { SetupChecklist } from "./setup-checklist";

const step = (etape: string) => `/famille/demarrer?etape=${etape}`;

/** Liste de démarrage de l'accueil parent, d'après l'état réel de la famille. */
export async function FamilyChecklist() {
  const api = await serverApi();
  const { hasFamily, children } = await load(api.onboarding.family.$get());
  // Sans famille gérée (parent seulement lié), pas de parcours à suivre.
  if (!hasFamily) return null;
  const all = (f: (c: (typeof children)[number]) => boolean) =>
    children.length > 0 && children.every(f);
  return (
    <SetupChecklist
      items={[
        { key: "family", done: hasFamily, href: step("famille") },
        { key: "child", done: children.length > 0, href: step("enfant") },
        {
          key: "program",
          done: all((c) => c.hasProgram),
          href: "/parent/famille",
        },
        {
          key: "placement",
          done: all((c) => c.placementDone),
          href: step("test"),
        },
        {
          key: "subscription",
          done: all((c) => c.access !== null),
          href: step("abonnement"),
        },
        {
          key: "diagnostic",
          done: all(
            (c) => c.diagnostic.status !== null || c.access === "contract",
          ),
          href: step("diagnostic"),
        },
      ]}
    />
  );
}
