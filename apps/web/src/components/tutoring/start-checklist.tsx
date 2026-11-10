import { ArrowRight, CheckCircle, Circle } from "@phosphor-icons/react/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { ProgressRing } from "@wema/ui/components/wema/progress-ring";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { load, serverApi } from "../../lib/api-server";
import { StepButton } from "./onboarding-actions";

/**
 * Liste de démarrage du prof particulier, sur son accueil : ce qui reste à
 * faire, déduit de ses données. Disparaît quand tout est fait ou masquée.
 */
export async function StartChecklist() {
  const api = await serverApi();
  const state = await load(api.tutoring.$get());
  if (!("steps" in state) || !state.organization) return null;
  if (state.steps.checklist) return null;
  const t = await getTranslations("tutoring.checklist");
  const items = [
    { key: "group", step: "groupe", done: state.classes.length > 0 },
    { key: "learners", step: "eleves", done: state.learners.length > 0 },
    {
      key: "parents",
      step: "parents",
      done:
        state.steps.parents !== undefined ||
        (state.learners.length > 0 &&
          state.learners.every((l) => l.guardians > 0)),
      skipped: state.steps.parents === "skipped",
    },
    { key: "assignment", step: "devoir", done: state.assignments > 0 },
  ] as const;
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;
  const nextStep = items.find((i) => !i.done)?.step ?? "bienvenue";

  return (
    <section
      aria-labelledby="start-checklist"
      className="space-y-4 rounded-card border border-brand/60 bg-brand-soft/40 p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-4">
        <ProgressRing
          value={done}
          max={items.length}
          size={52}
          thickness={5}
          tone="brand"
          label={t("progressLabel")}
          valueText={t("progress", { done, total: items.length })}
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
            {t("eyebrow")}
          </p>
          <h2 id="start-checklist" className="text-lg font-semibold">
            {t("title")}
          </h2>
        </div>
        <Button asChild variant="brand">
          <Link href={`/prof/demarrage?etape=${nextStep}`}>
            {t("open")}
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.key}>
            <Link
              href={`/prof/demarrage?etape=${i.step}`}
              className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              {i.done ? (
                <CheckCircle
                  weight="fill"
                  aria-hidden
                  className="size-5 shrink-0 text-success-text"
                />
              ) : (
                <Circle
                  aria-hidden
                  className="size-5 shrink-0 text-muted-foreground"
                />
              )}
              <span className={i.done ? "text-muted-foreground" : ""}>
                {t(i.key)}
              </span>
              {i.done ? (
                <Badge
                  variant={"skipped" in i && i.skipped ? "neutral" : "success"}
                  className="ml-auto"
                >
                  {"skipped" in i && i.skipped ? t("skipped") : t("done")}
                </Badge>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      <StepButton
        organizationId={state.organization.id}
        step="checklist"
        status="done"
        next={null}
        variant="ghost"
      >
        {t("hide")}
      </StepButton>
    </section>
  );
}
