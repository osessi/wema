import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { load, serverApi } from "../../../lib/api-server";
import { getSession } from "../../../lib/session";
import { isStep, ONBOARDING_STEPS } from "./steps";
import { OnboardingWizard } from "./wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("title") };
}

/**
 * Parcours guidé du parent après l'inscription : bienvenue, famille, enfant,
 * son accès, test de niveau (depuis le compte de l'enfant), abonnement,
 * rendez-vous de diagnostic. Chaque étape réutilise les formulaires existants
 * et peut être passée : la liste de démarrage de l'accueil reprend le reste.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ etape?: string }>;
}) {
  const session = await getSession();
  if (session.mustAcceptTerms) redirect("/compte/conditions");
  const { etape } = await searchParams;
  const step = etape && isStep(etape) ? etape : ONBOARDING_STEPS[0];
  const api = await serverApi();
  const overview = await load(api.family.$get());
  const family = overview.families[0] ?? null;
  // Sans famille, seules la bienvenue et la création de la famille ont un sens.
  if (!family && step !== "bienvenue" && step !== "famille")
    redirect("/famille/demarrer?etape=famille");

  const [steps, billing, diagnostic, members] = family
    ? await Promise.all([
        load(api.onboarding.family.$get()),
        load(api.parent.billing.$get()),
        load(api.diagnostic.family.$get()),
        load(
          api.admin.organizations[":id"].members.$get({
            param: { id: family.id },
          }),
        ),
      ])
    : [null, null, null, null];

  return (
    <OnboardingWizard
      step={step}
      userName={session.user.displayName}
      canCreate={overview.canCreate}
      family={family}
      catalog={overview.catalog}
      kids={overview.children}
      steps={steps?.children ?? []}
      billing={billing}
      diagnostic={diagnostic}
      identities={(members?.members ?? []).map((m) => ({
        userId: m.userId,
        identities: m.identities,
      }))}
    />
  );
}
