"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CheckCircle,
  Copy,
  CreditCard,
  Exam,
  HandWaving,
  Key,
  Printer,
  UserPlus,
  UsersThree,
} from "@phosphor-icons/react";
import { GlowTile, type GlowTone } from "@wema/ui/components/brand/glow-tile";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { toast } from "@wema/ui/components/ui/sonner";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { StepTrail } from "@wema/ui/components/wema/step-trail";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { AddChildForm } from "../../../components/guardian/add-child-form";
import { DiagnosticBooking } from "../../../components/onboarding/diagnostic-booking";
import type { ParentBilling } from "../../../lib/billing-types";
import type { CatalogProgram, FamilyChild } from "../../../lib/family-types";
import { mutate, read } from "../../../lib/mutate";
import type {
  ChildSteps,
  FamilyDiagnostic,
} from "../../../lib/onboarding-types";
import type { MemberList } from "../../../lib/types";
import { SubscribeForm } from "../../parent/abonnements/subscribe-form";
import { CreateFamilyForm } from "../creer/create-family-form";
import { ONBOARDING_STEPS, type OnboardingStep, STEP_KEY } from "./steps";

const ICONS: Record<OnboardingStep, { icon: ReactNode; tone: GlowTone }> = {
  bienvenue: { icon: <HandWaving weight="fill" />, tone: "yellow" },
  famille: { icon: <UsersThree weight="fill" />, tone: "sky" },
  enfant: { icon: <UserPlus weight="fill" />, tone: "mint" },
  acces: { icon: <Key weight="fill" />, tone: "amber" },
  test: { icon: <Exam weight="fill" />, tone: "rose" },
  abonnement: { icon: <CreditCard weight="fill" />, tone: "slate" },
  diagnostic: { icon: <CalendarCheck weight="fill" />, tone: "yellow" },
};

const href = (step: OnboardingStep) => `/famille/demarrer?etape=${step}`;

interface Access {
  learnerId: string;
  name: string;
  username: string | null;
  code: string | null;
}

export function OnboardingWizard({
  step,
  userName,
  canCreate,
  family,
  catalog,
  kids,
  steps,
  billing,
  diagnostic,
  identities,
}: {
  step: OnboardingStep;
  userName: string;
  canCreate: boolean;
  family: { id: string; name: string } | null;
  catalog: readonly CatalogProgram[];
  kids: readonly FamilyChild[];
  steps: readonly ChildSteps[];
  billing: ParentBilling | null;
  diagnostic: FamilyDiagnostic | null;
  identities: {
    userId: string;
    identities: MemberList[number]["identities"];
  }[];
}) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  // Accès de l'enfant tout juste créé : le code n'est montré qu'une fois.
  const [created, setCreated] = useState<Access | null>(null);
  const index = ONBOARDING_STEPS.indexOf(step);
  const previous = ONBOARDING_STEPS[index - 1];
  const next = ONBOARDING_STEPS[index + 1];

  const every = (f: (c: ChildSteps) => boolean) =>
    steps.length > 0 && steps.every(f);
  const completed: Record<OnboardingStep, boolean> = {
    bienvenue: index > 0,
    famille: family !== null,
    enfant: kids.length > 0,
    acces: kids.length > 0,
    test: every((c) => c.placementDone),
    abonnement: every((c) => c.access !== null),
    diagnostic: every((c) => c.diagnostic.status !== null),
  };

  const content: Record<OnboardingStep, () => ReactNode> = {
    bienvenue: () => (
      <ul className="flex flex-col gap-3">
        {(["family", "placement", "diagnostic"] as const).map((k) => (
          <li key={k} className="flex items-start gap-3 text-sm">
            <CheckCircle
              aria-hidden
              weight="fill"
              className="mt-0.5 size-5 shrink-0 text-success-text"
            />
            {t(`welcome.points.${k}`)}
          </li>
        ))}
      </ul>
    ),
    famille: () =>
      family ? (
        <p className="flex items-center gap-2 text-sm text-success-text">
          <CheckCircle aria-hidden weight="fill" />
          {t("family.done", { name: family.name })}
        </p>
      ) : canCreate ? (
        <CreateFamilyForm defaultName={userName} next={href("enfant")} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("family.notAllowed")}
        </p>
      ),
    enfant: () =>
      family ? (
        <ChildStep
          familyId={family.id}
          catalog={catalog}
          kids={kids}
          onCreated={(child) => {
            setCreated(child);
            router.push(href("acces"));
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("child.needFamily")}</p>
      ),
    acces: () =>
      family && kids.length > 0 ? (
        <div className="flex flex-col gap-4">
          {created ? <AccessCard access={created} /> : null}
          {kids
            .filter((k) => k.learnerId !== created?.learnerId)
            .map((k) => (
              <KnownAccess
                key={k.learnerId}
                familyId={family.id}
                child={k}
                identities={
                  identities.find((i) => i.userId === k.learnerId)
                    ?.identities ?? []
                }
              />
            ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("access.none")}</p>
      ),
    test: () => (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("placement.intake")}</p>
        <ul className="flex flex-col divide-y rounded-card border">
          {steps.map((c) => (
            <li
              key={c.learnerId}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <span className="font-medium">{c.displayName}</span>
              <span className="flex flex-wrap gap-2">
                <Badge variant={c.placementDone ? "success" : "neutral"}>
                  {t(c.placementDone ? "placement.done" : "placement.todo")}
                </Badge>
                <Badge variant={c.intakeDone ? "success" : "neutral"}>
                  {t(
                    c.intakeDone
                      ? "placement.intakeDone"
                      : "placement.intakeTodo",
                  )}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      </div>
    ),
    abonnement: () =>
      billing && billing.children.length > 0 ? (
        <div className="flex flex-col gap-4">
          {billing.children.map((child) => {
            const open = child.subscriptions.filter((s) => s.open);
            return (
              <section
                key={child.learnerId}
                aria-label={child.displayName}
                className="flex flex-col gap-3 rounded-card border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{child.displayName}</h3>
                  {open.length > 0 ? (
                    <Badge variant="success">
                      {t("subscription.active")} ·{" "}
                      {open.map((s) => s.subjectName).join(", ")}
                    </Badge>
                  ) : null}
                </div>
                {child.underContract ? (
                  <p className="text-sm">{t("subscription.contract")}</p>
                ) : (
                  <SubscribeForm child={child} offers={billing.offers} />
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("subscription.none")}
        </p>
      ),
    diagnostic: () => (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {t("diagnostic.noMedical")}
        </p>
        {(diagnostic?.children ?? []).map((child) => (
          <section
            key={child.learnerId}
            aria-label={child.displayName}
            className="flex flex-col gap-3 rounded-card border p-4"
          >
            <h3 className="font-medium">{child.displayName}</h3>
            <DiagnosticBooking child={child} />
          </section>
        ))}
      </div>
    ),
  };

  const key = STEP_KEY[step];
  const minutes = diagnostic?.minutes ?? 15;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-4 print:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-medium">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-lg bg-brand font-semibold text-ink-on-brand"
            >
              W
            </span>
            {t("title")}
          </p>
          {family ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/parent">{t("nav.finish")}</Link>
            </Button>
          ) : null}
        </div>
        <p className="font-mono text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase sm:hidden">
          {t("stepOf", { current: index + 1, total: ONBOARDING_STEPS.length })}
        </p>
        <StepTrail
          className="hidden sm:flex"
          label={t("trailLabel")}
          steps={ONBOARDING_STEPS.map((s) => ({
            id: s,
            label: t(`steps.${STEP_KEY[s]}`),
            state: s === step ? "current" : completed[s] ? "done" : "upcoming",
            render: family
              ? (inner: ReactNode) => <Link href={href(s)}>{inner}</Link>
              : undefined,
          }))}
        />
      </header>

      <section
        aria-labelledby="step-title"
        className="flex flex-col gap-6 rounded-card border bg-card p-5 shadow-xs sm:p-8"
      >
        <div className="flex items-start gap-4 print:hidden">
          <GlowTile tone={ICONS[step].tone} size={48}>
            {ICONS[step].icon}
          </GlowTile>
          <div className="min-w-0 space-y-1.5">
            <h1
              id="step-title"
              className="text-2xl leading-tight font-medium tracking-tight sm:text-[28px]"
            >
              {t(`${key}.title`)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {key === "diagnostic"
                ? t("diagnostic.body", { minutes })
                : t(`${key}.body`)}
            </p>
          </div>
        </div>
        {content[step]()}
      </section>

      <nav
        aria-label={t("trailLabel")}
        className="flex flex-wrap items-center justify-between gap-3 print:hidden"
      >
        {previous ? (
          <Button asChild variant="ghost">
            <Link href={href(previous)}>
              <ArrowLeft aria-hidden />
              {t("nav.back")}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {step === "bienvenue" ? (
          <Button asChild variant="bevel">
            <Link href={href("famille")}>{t("welcome.start")}</Link>
          </Button>
        ) : next ? (
          // On ne passe pas la création de la famille : tout le reste en dépend.
          family ? (
            <Button asChild variant={completed[step] ? "brand" : "outline"}>
              <Link href={href(next)}>
                {completed[step] ? t("nav.next") : t("nav.skip")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : null
        ) : (
          <Button asChild variant="brand">
            <Link href="/parent">
              {t("nav.finish")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
      </nav>
    </main>
  );
}

/** Enfants déjà inscrits, puis le formulaire d'ajout (existant). */
function ChildStep({
  familyId,
  catalog,
  kids,
  onCreated,
}: {
  familyId: string;
  catalog: readonly CatalogProgram[];
  kids: readonly FamilyChild[];
  onCreated: (child: Access) => void;
}) {
  const t = useTranslations("onboarding.child");
  const [adding, setAdding] = useState(kids.length === 0);
  return (
    <div className="flex flex-col gap-5">
      {kids.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{t("existing")}</h2>
          <ul className="flex flex-col divide-y rounded-card border">
            {kids.map((k) => (
              <li
                key={k.learnerId}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <span className="font-medium">{k.displayName}</span>
                <span className="text-sm text-muted-foreground">
                  {k.programs.length > 0
                    ? `${k.programs[0]?.gradeName ?? ""} · ${k.programs.map((p) => p.subjectName).join(", ")}`
                    : t("programs", { count: 0 })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {adding ? (
        <AddChildForm
          familyId={familyId}
          catalog={catalog}
          onCreated={onCreated}
        />
      ) : (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => setAdding(true)}
        >
          <UserPlus aria-hidden />
          {t("another")}
        </Button>
      )}
    </div>
  );
}

/** Identifiant et code d'un enfant, en grand, à imprimer ou à copier. */
function AccessCard({ access }: { access: Access }) {
  const t = useTranslations("onboarding.access");
  return (
    <div className="flex flex-col gap-4 rounded-card border-2 border-brand bg-brand-soft p-5 print:border-black">
      <h2 className="text-lg font-medium">
        {t("cardTitle", { name: access.name })}
      </h2>
      {access.username ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase">
              {t("username")}
            </dt>
            <dd className="font-mono text-xl break-all">{access.username}</dd>
          </div>
          {access.code ? (
            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase">
                {t("code")}
              </dt>
              <dd className="font-mono text-2xl tracking-widest">
                {access.code}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {access.code ? (
        <>
          <p className="text-sm">{t("once")}</p>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    t("copyText", {
                      username: access.username ?? "",
                      code: access.code ?? "",
                    }),
                  );
                  toast.success(t("copied"));
                } catch {
                  // Copie refusée par le navigateur : le code reste affiché.
                }
              }}
            >
              <Copy aria-hidden />
              {t("copy")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer aria-hidden />
              {t("print")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Accès d'un enfant déjà créé : son identifiant, et un nouveau code si besoin. */
function KnownAccess({
  familyId,
  child,
  identities,
}: {
  familyId: string;
  child: FamilyChild;
  identities: MemberList[number]["identities"];
}) {
  const t = useTranslations("onboarding.access");
  const [code, setCode] = useState<string | null>(null);
  const username =
    identities.find((i) => i.kind === "username")?.identifier ?? null;
  const email = identities.find((i) => i.kind === "email")?.identifier ?? null;
  if (code)
    return (
      <AccessCard
        access={{
          learnerId: child.learnerId,
          name: child.displayName,
          username,
          code,
        }}
      />
    );
  return (
    <div className="flex flex-col gap-3 rounded-card border p-4 print:hidden">
      <h2 className="font-medium">
        {t("cardTitle", { name: child.displayName })}
      </h2>
      {username ? (
        <>
          <p className="text-sm">
            {t("username")} :{" "}
            <strong className="font-mono font-medium">{username}</strong>
          </p>
          <p className="text-sm text-muted-foreground">{t("noCode")}</p>
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm" className="self-start">
                <Key aria-hidden />
                {t("newCode")}
              </Button>
            }
            title={t("newCodeConfirm", { name: child.displayName })}
            description={t("newCodeText")}
            onConfirm={async () => {
              const result = await mutate(
                "POST",
                `/admin/organizations/${familyId}/members/${child.learnerId}/login-code`,
              );
              const value = result.ok ? read(result.data, "loginCode") : null;
              if (typeof value !== "string") return false;
              setCode(value);
              return true;
            }}
          />
        </>
      ) : email ? (
        <p className="text-sm">{t("email", { email })}</p>
      ) : null}
    </div>
  );
}
