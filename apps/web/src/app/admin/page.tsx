import {
  ArrowRight,
  BookOpenText,
  Buildings,
  CaretRight,
  CheckCircle,
  CurrencyDollar,
  EnvelopeSimple,
  Gauge,
  Student,
} from "@phosphor-icons/react/dist/ssr";
import { GlowTile, type GlowTone } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Card } from "@wema/ui/components/ui/card";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { StatTile } from "@wema/ui/components/wema/stat-tile";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHeader } from "../../components/page-header";
import { load, serverApi } from "../../lib/api-server";
import { visibleSections } from "../../lib/nav";
import { getSession } from "../../lib/session";
import { fillDays, formatUsd, usdOptions } from "./_ui/days";
import { Notice } from "./_ui/fields";
import { MonoLabel, Panel } from "./_ui/kit";
import { SECTION_LOOK } from "./_ui/sections";

/** Demandes de contact examinées pour compter celles à traiter. */
const RECENT_CONTACTS = 50;
const RECENT_ACTIVITY = 6;

interface TodoItem {
  key: string;
  href: string;
  tone: GlowTone;
  icon: ReactNode;
  label: string;
  hint: string;
  count: number;
}

export default async function AdminHome() {
  const session = await getSession();
  const t = await getTranslations("home");
  const tAudit = await getTranslations("audit");
  const tNav = await getTranslations("nav");
  const format = await getFormatter();
  const visible = visibleSections(session);
  const can = new Set(visible.map((s) => s.key));
  const api = await serverApi();

  const [costs, orgs, curriculum, contacts, audit] = await Promise.all([
    can.has("costs") ? load(api.admin.costs.$get({ query: {} })) : null,
    can.has("organizations") ? load(api.admin.organizations.$get()) : null,
    can.has("curriculum")
      ? load(api.admin.curriculum.countries.$get()).then(({ countries }) =>
          Promise.all(
            countries
              .filter((c) => !c.archived)
              .map((c) =>
                load(
                  api.admin.curriculum.countries[":id"].curriculum.$get({
                    param: { id: c.id },
                  }),
                ),
              ),
          ),
        )
      : null,
    can.has("contacts")
      ? load(
          api.admin["contact-requests"].$get({
            query: { page: "1", pageSize: String(RECENT_CONTACTS) },
          }),
        )
      : null,
    can.has("audit") ? load(api.admin.audit.$get({ query: {} })) : null,
  ]);

  // Notions actives encore « À valider », pays par pays.
  const notionsByCountry = (curriculum ?? []).map((c) => {
    const active = c.notions.filter((n) => !n.archived);
    return {
      id: c.country.id,
      name: c.country.name,
      total: active.length,
      pending: active.filter((n) => !n.verified).length,
    };
  });
  const notionsTotal = notionsByCountry.reduce((s, c) => s + c.total, 0);
  const notionsPending = notionsByCountry.reduce((s, c) => s + c.pending, 0);
  const contactsPending =
    contacts?.requests.filter((r) => !r.handledAt).length ?? 0;
  const capAlerts = costs?.alerts.length ?? 0;
  const daily = costs ? fillDays(costs.daily) : [];

  const stats: ReactNode[] = [];
  if (costs) {
    stats.push(
      <StatTile
        key="learners"
        label={t("stats.activeLearners")}
        value={costs.learners.activeLearners}
        hint={t("stats.last30")}
        icon={<Student weight="fill" />}
        tone="mint"
      />,
      <StatTile
        key="cost"
        label={t("stats.aiCost")}
        value={costs.totalCostUsd}
        format={usdOptions(costs.totalCostUsd)}
        hint={t("stats.perLearner", {
          value: formatUsd(costs.learners.costPerActiveLearnerUsd),
        })}
        icon={<CurrencyDollar weight="bold" />}
        tone="rose"
        trend={daily.length > 1 ? daily.map((d) => d.costUsd) : undefined}
      />,
    );
  }
  if (curriculum) {
    stats.push(
      <StatTile
        key="notions"
        label={t("stats.notionsPending")}
        value={notionsPending}
        hint={t("stats.notionsOf", { total: notionsTotal })}
        icon={<BookOpenText weight="fill" />}
        tone="amber"
      />,
    );
  }
  if (orgs) {
    const schools = orgs.organizations.filter((o) => o.kind === "school");
    stats.push(
      <StatTile
        key="orgs"
        label={t("stats.organizations")}
        value={orgs.organizations.length}
        hint={t("stats.schools", { count: schools.length })}
        icon={<Buildings weight="fill" />}
        tone="sky"
      />,
    );
  }

  const todo: TodoItem[] = [];
  for (const c of notionsByCountry) {
    if (c.pending === 0) continue;
    todo.push({
      key: `notions-${c.id}`,
      href: `/admin/referentiel/${c.id}`,
      tone: "amber",
      icon: <BookOpenText weight="fill" />,
      label: t("todo.notions", { country: c.name }),
      hint: t("todo.notionsHint", { total: c.total }),
      count: c.pending,
    });
  }
  if (contactsPending > 0) {
    todo.push({
      key: "contacts",
      href: "/admin/contacts",
      tone: "rose",
      icon: <EnvelopeSimple weight="fill" />,
      label: t("todo.contacts"),
      hint: t("todo.contactsHint", { recent: RECENT_CONTACTS }),
      count: contactsPending,
    });
  }
  if (capAlerts > 0) {
    todo.push({
      key: "caps",
      href: "/admin/couts",
      tone: "rose",
      icon: <Gauge weight="fill" />,
      label: t("todo.caps"),
      hint: t("todo.capsHint"),
      count: capAlerts,
    });
  }

  const activity = audit?.entries.slice(0, RECENT_ACTIVITY) ?? [];
  const now = new Date();

  return (
    <>
      <PageHeader
        title={t("title", { name: session.user.displayName })}
        description={t("subtitle")}
      />
      {visible.length === 0 ? (
        <Notice>{t("noAccess")}</Notice>
      ) : (
        <>
          {stats.length > 0 ? (
            <section
              aria-label={t("stats.label")}
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full"
            >
              {stats}
            </section>
          ) : null}

          {curriculum || contacts || costs || audit ? (
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <Panel
                icon={<CheckCircle weight="fill" />}
                tone="amber"
                title={t("todo.title")}
                description={t("todo.subtitle")}
                className="h-full"
              >
                {todo.length === 0 ? (
                  <EmptyState
                    variant="inline"
                    icon={<CheckCircle weight="fill" />}
                    tone="mint"
                    title={t("todo.none")}
                    titleAs="p"
                  />
                ) : (
                  <ul className="-mx-2 flex flex-col">
                    {todo.map((i) => (
                      <li key={i.key}>
                        <Link
                          href={i.href}
                          className="group flex items-center gap-3 rounded-lg px-2 py-2.5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          <GlowTile tone={i.tone} size={32}>
                            {i.icon}
                          </GlowTile>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {i.label}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {i.hint}
                            </span>
                          </span>
                          <Badge variant="warning" className="tabular-nums">
                            {format.number(i.count)}
                          </Badge>
                          <CaretRight
                            aria-hidden
                            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {audit ? (
                <Panel
                  icon={<SECTION_LOOK.audit.Icon weight="bold" />}
                  tone={SECTION_LOOK.audit.tone}
                  title={t("activity.title")}
                  description={t("activity.subtitle")}
                  actions={
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/admin/journal">
                        {t("activity.all")}
                        <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  }
                  className="h-full"
                >
                  {activity.length === 0 ? (
                    <EmptyState
                      variant="inline"
                      title={tAudit("none")}
                      titleAs="p"
                    />
                  ) : (
                    <ol className="flex flex-col">
                      {activity.map((e) => {
                        const actor = e.actorName ?? tAudit("system");
                        return (
                          <li
                            key={e.id}
                            className="flex items-center gap-3 border-b py-2.5 last:border-0"
                          >
                            <span
                              aria-hidden
                              className="grid size-8 shrink-0 place-items-center rounded-full bg-muted font-mono text-[11px] font-medium text-muted-foreground uppercase"
                            >
                              {initials(actor)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">
                                {tAudit.has(`actions.${e.action}`)
                                  ? tAudit(`actions.${e.action}`)
                                  : e.action}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {actor}
                              </span>
                            </span>
                            <time
                              dateTime={e.at}
                              className="shrink-0 text-xs text-muted-foreground tabular-nums"
                            >
                              {format.relativeTime(new Date(e.at), now)}
                            </time>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </Panel>
              ) : null}
            </div>
          ) : null}

          <section aria-labelledby="admin-shortcuts" className="space-y-3">
            <MonoLabel>
              <span id="admin-shortcuts">{t("shortcuts")}</span>
            </MonoLabel>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((s) => {
                const look = SECTION_LOOK[s.key];
                return (
                  <Link
                    key={s.key}
                    href={s.href}
                    className="group rounded-card outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <Card className="h-full flex-row items-start gap-3 p-4 transition-colors group-hover:bg-muted/40">
                      <GlowTile tone={look.tone} size={36}>
                        <look.Icon weight="fill" />
                      </GlowTile>
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="flex items-center gap-1 text-sm font-semibold">
                          {tNav(s.key)}
                          <CaretRight
                            aria-hidden
                            className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                          />
                        </span>
                        <span className="block text-[13px] leading-snug text-muted-foreground">
                          {t(`cards.${s.key}`)}
                        </span>
                      </span>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
