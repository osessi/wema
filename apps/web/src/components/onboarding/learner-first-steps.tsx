import { ArrowRight, Sparkle } from "@phosphor-icons/react/ssr";
import { GlowTile } from "@wema/ui/components/brand/glow-tile";
import { Button } from "@wema/ui/components/ui/button";
import { StepTrail } from "@wema/ui/components/wema/step-trail";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { load, serverApi } from "../../lib/api-server";

const PLACEMENT_HREF = "/eleve/positionnement";
const INTAKE_HREF = "/eleve/prof-ia?mode=intake";

/**
 * Première connexion de l'élève : tant que son test de niveau, puis son
 * échange avec le prof IA ne sont pas faits, son accueil les propose en tête.
 * Rien n'est bloqué : le reste de l'espace reste ouvert.
 */
export async function LearnerFirstSteps() {
  const t = await getTranslations("onboarding.learner");
  const api = await serverApi();
  const { placementDone, intakeDone } = await load(
    api.onboarding.learner.$get(),
  );
  if (placementDone && intakeDone) return null;
  const next = placementDone
    ? { href: INTAKE_HREF, label: t("intakeAction") }
    : { href: PLACEMENT_HREF, label: t("placementAction") };
  return (
    <section
      aria-labelledby="first-steps-title"
      className="flex flex-col gap-6 rounded-card border-2 border-brand bg-[radial-gradient(120%_140%_at_0%_0%,var(--brand-soft)_0%,transparent_60%)] p-6 sm:p-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <GlowTile tone="yellow" size={56} idle="breathe">
          <Sparkle weight="fill" />
        </GlowTile>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {t("eyebrow")}
          </p>
          <h2
            id="first-steps-title"
            className="text-2xl leading-tight font-medium tracking-tight"
          >
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("body")}</p>
        </div>
        <Button asChild variant="bevel" className="shrink-0">
          <Link href={next.href}>
            {next.label}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
      <StepTrail
        label={t("stepsLabel")}
        steps={[
          {
            id: "placement",
            label: t("placement"),
            description: t("placementText"),
            state: placementDone ? "done" : "current",
            render: (inner) => <Link href={PLACEMENT_HREF}>{inner}</Link>,
          },
          {
            id: "intake",
            label: t("intake"),
            description: t("intakeText"),
            state: intakeDone ? "done" : placementDone ? "current" : "upcoming",
            render: (inner) => <Link href={INTAKE_HREF}>{inner}</Link>,
          },
        ]}
      />
    </section>
  );
}
