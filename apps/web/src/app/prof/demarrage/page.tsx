import {
  ArrowRight,
  Books,
  ChalkboardTeacher,
  HandWaving,
  Student,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import { GlowTile } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { StepTrail } from "@wema/ui/components/wema/step-trail";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHeader } from "../../../components/page-header";
import { loadPrograms } from "../../../components/school/programs";
import { isSuccess, notionIndex } from "../../../components/teacher/data";
import { GiveAssignmentDialog } from "../../../components/teacher/give-assignment";
import { GuardianForm } from "../../../components/tutoring/guardian-form";
import {
  GroupForm,
  StepButton,
} from "../../../components/tutoring/onboarding-actions";
import { RosterImport } from "../../../components/tutoring/roster-import";
import { load, serverApi } from "../../../lib/api-server";
import { getSession } from "../../../lib/session";

const STEPS = ["bienvenue", "groupe", "eleves", "parents", "devoir"] as const;
type Step = (typeof STEPS)[number];
const isStep = (v: string | undefined): v is Step => STEPS.some((s) => s === v);
const href = (step: Step) => `/prof/demarrage?etape=${step}`;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tutoring.onboarding");
  return { title: t("title") };
}

/**
 * Démarrage du prof particulier, en cinq étapes qui réutilisent les écrans
 * existants : bienvenue, groupe (classe avec programme), élèves (un par un ou
 * en masse, fiche des codes), parents (facultatif), premier devoir.
 */
export default async function TutorOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ etape?: string }>;
}) {
  const { etape } = await searchParams;
  const t = await getTranslations("tutoring.onboarding");
  const api = await serverApi();
  const [session, state] = await Promise.all([
    getSession(),
    load(api.tutoring.$get()),
  ]);
  // Réservé au prof particulier qui gère son organisation.
  if (!("steps" in state) || !state.organization) redirect("/prof");
  const org = state.organization;
  const step: Step = isStep(etape) ? etape : "bienvenue";
  const index = STEPS.indexOf(step);
  const doneOf: Record<Step, boolean> = {
    bienvenue: state.steps.welcome === "done",
    groupe: state.classes.length > 0,
    eleves: state.learners.length > 0,
    parents:
      state.steps.parents !== undefined ||
      (state.learners.length > 0 &&
        state.learners.every((l) => l.guardians > 0)),
    devoir: state.assignments > 0,
  };
  const next = STEPS[index + 1];
  const prev = STEPS[index - 1];
  const classes = state.classes.map((k) => ({ id: k.id, name: k.name }));

  let body: ReactNode;
  if (step === "bienvenue")
    body = (
      <StepCard
        icon={<HandWaving weight="fill" />}
        title={t("welcome.title", { name: session.user.displayName })}
        text={t("welcome.body")}
      >
        <p className="text-sm text-muted-foreground">{t("welcome.contract")}</p>
        <StepButton
          organizationId={org.id}
          step="welcome"
          status="done"
          next={href("groupe")}
          variant="bevel"
        >
          {t("welcome.start")}
        </StepButton>
      </StepCard>
    );
  else if (step === "groupe") {
    const programs = await loadPrograms();
    body = (
      <StepCard
        icon={<ChalkboardTeacher weight="fill" />}
        title={t("group.title")}
        text={t("group.body")}
      >
        {classes.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label={t("group.existing")}>
            {classes.map((k) => (
              <li key={k.id}>
                <Badge variant="info">{k.name}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="space-y-3 rounded-card border p-4">
          <h3 className="text-sm font-semibold">{t("group.createTitle")}</h3>
          <GroupForm
            organizationId={org.id}
            programs={programs}
            userId={session.user.id}
            next={href("eleves")}
          />
        </div>
      </StepCard>
    );
  } else if (step === "eleves")
    body = (
      <StepCard
        icon={<Student weight="fill" />}
        title={t("learners.title")}
        text={t("learners.body")}
        aside={
          <Badge variant={state.learners.length > 0 ? "success" : "neutral"}>
            {t("learners.count", { count: state.learners.length })}
          </Badge>
        }
      >
        {classes.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<ChalkboardTeacher weight="fill" />}
            tone="sky"
            title={t("learners.needGroup")}
            titleAs="p"
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={href("groupe")}>{t("steps.groupe")}</Link>
              </Button>
            }
          />
        ) : (
          <RosterImport
            organizationId={org.id}
            classes={classes}
            defaultClassId={classes.at(-1)?.id ?? null}
          />
        )}
      </StepCard>
    );
  else if (step === "parents")
    body = (
      <StepCard
        icon={<UsersThree weight="fill" />}
        title={t("parents.title")}
        text={t("parents.body")}
      >
        {state.steps.parents === "skipped" ? (
          <p className="text-sm text-muted-foreground">
            {t("parents.skipped")}
          </p>
        ) : null}
        {state.learners.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("parents.none")}</p>
        ) : (
          <ul className="divide-y rounded-card border">
            {state.learners.map((l) => (
              <li
                key={l.userId}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 sm:w-56">
                  <p className="truncate font-medium">{l.displayName}</p>
                  {l.username ? (
                    <p className="font-mono text-xs text-muted-foreground">
                      {l.username}
                    </p>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  {l.guardians > 0 ? (
                    <Badge variant="success">
                      {t("parents.linked", { count: l.guardians })}
                    </Badge>
                  ) : (
                    <GuardianForm
                      organizationId={org.id}
                      learnerId={l.userId}
                      learnerName={l.displayName}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {state.steps.parents === "skipped" ? null : (
          <StepButton
            organizationId={org.id}
            step="parents"
            status="skipped"
            next={href("devoir")}
            variant="ghost"
          >
            {t("parents.skip")}
          </StepButton>
        )}
      </StepCard>
    );
  else {
    // Exercices validés, ceux du programme du groupe d'abord.
    const res = await api.admin.organizations[":id"].exercises.$get({
      param: { id: org.id },
      query: { status: "validated" },
    });
    const exercises = isSuccess(res) ? (await res.json()).exercises : [];
    const notions = await notionIndex();
    const programs = new Set<string | null>(
      state.classes.map((k) => k.programId),
    );
    const assignable = exercises
      .map((x) => {
        const notion = notions.get(x.notionId);
        return {
          id: x.id,
          objective: x.objective,
          notionId: x.notionId,
          notionName: notion?.name ?? null,
          inClass: notion ? programs.has(notion.programId) : false,
        };
      })
      .sort((a, b) => Number(b.inClass) - Number(a.inClass));
    body = (
      <StepCard
        icon={<Books weight="fill" />}
        title={t("assignment.title")}
        text={t("assignment.body")}
        aside={
          state.assignments > 0 ? (
            <Badge variant="success">
              {t("assignment.done", { count: state.assignments })}
            </Badge>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {classes.length === 0 || state.learners.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("assignment.needGroup")}
            </p>
          ) : assignable.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("assignment.noExercises")}
            </p>
          ) : (
            <GiveAssignmentDialog
              classes={classes}
              exercises={assignable}
              trigger={<Button variant="brand">{t("assignment.give")}</Button>}
            />
          )}
          <Button asChild variant="outline">
            <Link href={`/prof/banque?org=${org.id}`}>
              {t("assignment.bank")}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </StepCard>
    );
  }

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <StepTrail
        label={t("trailLabel")}
        steps={STEPS.map((s, i) => ({
          id: s,
          label: t(`steps.${s}`),
          state:
            s === step
              ? "current"
              : doneOf[s] || i < index
                ? "done"
                : "upcoming",
          render: (content) => (
            <Link
              href={href(s)}
              aria-current={s === step ? "step" : undefined}
              className="rounded-chip outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {content}
            </Link>
          ),
        }))}
      />
      {body}
      <nav
        aria-label={t("trailLabel")}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        {prev ? (
          <Button asChild variant="ghost">
            <Link href={href(prev)}>{t("back")}</Link>
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          step === "bienvenue" ? null : (
            <Button asChild variant="outline">
              <Link href={href(next)}>
                {doneOf[step] ? t("next") : t("later")}
                <ArrowRight />
              </Link>
            </Button>
          )
        ) : (
          <Button asChild variant="outline">
            <Link href="/prof">
              {t("finish")}
              <ArrowRight />
            </Link>
          </Button>
        )}
      </nav>
    </>
  );
}

function StepCard({
  icon,
  title,
  text,
  aside,
  children,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby="step-title"
      className="space-y-5 rounded-card border bg-card p-4 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-start gap-4">
        <GlowTile tone="yellow" size={44}>
          {icon}
        </GlowTile>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 id="step-title" className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{text}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
