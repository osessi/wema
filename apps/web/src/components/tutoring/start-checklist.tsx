import { ArrowRight } from "@phosphor-icons/react/ssr";
import { SetupChecklist } from "@wema/ui/components/patterns/setup-checklist";
import { Button } from "@wema/ui/components/ui/button";
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
  const firstTodo = items.find((i) => !i.done)?.key;

  return (
    <SetupChecklist
      title={t("title")}
      description={t("eyebrow")}
      labels={{
        count: (d, total) => t("progress", { done: d, total }),
        progress: t("progressLabel"),
        status: { done: t("done") },
      }}
      items={items.map((i) => ({
        id: i.key,
        label: (
          <Link
            href={`/prof/demarrage?etape=${i.step}`}
            className="rounded-chip outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t(i.key)}
          </Link>
        ),
        status: i.done
          ? "done"
          : i.key === firstTodo
            ? "current"
            : i.key === "parents"
              ? "optional"
              : "pending",
        ...("skipped" in i && i.skipped ? { description: t("skipped") } : {}),
      }))}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="brand">
            <Link href={`/prof/demarrage?etape=${nextStep}`}>
              {t("open")}
              <ArrowRight />
            </Link>
          </Button>
          <StepButton
            organizationId={state.organization.id}
            step="checklist"
            status="done"
            next={null}
            variant="ghost"
          >
            {t("hide")}
          </StepButton>
        </div>
      }
    />
  );
}
