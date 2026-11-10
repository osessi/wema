import {
  ClockCounterClockwise,
  Gear,
  MinusCircle,
  PencilSimple,
  PlusCircle,
  Robot,
} from "@phosphor-icons/react/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { Card } from "@wema/ui/components/ui/card";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { PersonAvatar } from "@wema/ui/components/wema/person-avatar";
import { cn } from "@wema/ui/lib/utils";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHeader } from "../../../../components/page-header";
import { getSchool } from "../../../../components/school/school-context";
import { load, serverApi } from "../../../../lib/api-server";

type Family = "create" | "remove" | "update" | "other";

const REMOVE =
  /(delete|remove|unshare|rejected|archive|purge|cancel|deletion_request)$/;
const CREATE =
  /(create|add|declare|share|consent|import|propose|proposed|selected|validate|trial|parental_consent|complete|comics|role_add|member_add)$/;
const UPDATE =
  /(update|contract|set|prerequisites|contextualize|simplify|tutor_instructions|login_code|preference|compute|assess|reported|export|deletion_cancel)$/;

function familyOf(action: string): Family {
  const verb = action.split(".").pop() ?? action;
  if (REMOVE.test(verb)) return "remove";
  if (CREATE.test(verb)) return "create";
  if (UPDATE.test(verb)) return "update";
  return "other";
}

const FAMILY: Record<
  Family,
  {
    badge: "success" | "danger" | "info" | "neutral";
    dot: string;
    icon: ReactNode;
  }
> = {
  create: {
    badge: "success",
    dot: "bg-success-soft text-success-text",
    icon: <PlusCircle weight="fill" />,
  },
  remove: {
    badge: "danger",
    dot: "bg-danger-soft text-danger-text",
    icon: <MinusCircle weight="fill" />,
  },
  update: {
    badge: "info",
    dot: "bg-info-soft text-info-text",
    icon: <PencilSimple weight="fill" />,
  },
  other: {
    badge: "neutral",
    dot: "bg-muted text-muted-foreground",
    icon: <Gear weight="fill" />,
  },
};

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { school, can } = await getSchool(orgId);
  if (!can("audit.read")) notFound();
  const t = await getTranslations("school.audit");
  const format = await getFormatter();
  const api = await serverApi();
  const { entries } = await load(
    api.admin.audit.$get({ query: { organizationId: orgId } }),
  );

  // Groupes par jour ; les actions identiques d'un même acteur, consécutives
  // ou dans la même rafale, sont regroupées (« Système · Exercice créé × 8 »).
  type Row = {
    id: string;
    at: Date;
    first: Date;
    actor: string | null;
    actorId: string | null;
    action: string;
    count: number;
    minute: string;
  };
  const time = (d: Date) => format.dateTime(d, { timeStyle: "short" });
  let burst: Row[] = [];
  const days: { key: string; label: string; rows: Row[] }[] = [];
  for (const e of entries) {
    const at = new Date(e.at);
    const key = format.dateTime(at, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = {
        key,
        label: format.dateTime(at, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        rows: [],
      };
      days.push(day);
    }
    // Rafale : entrées consécutives du même acteur dans la même minute.
    const last = day.rows[day.rows.length - 1];
    const minute = time(at);
    if (!last || last.actor !== e.actorName || last.minute !== minute)
      burst = [];
    const same =
      burst.find((r) => r.action === e.action) ??
      (last && last.actor === e.actorName && last.action === e.action
        ? last
        : undefined);
    if (same) {
      same.count += 1;
      same.first = at;
    } else {
      day.rows.push({
        id: e.id,
        at,
        first: at,
        actor: e.actorName,
        actorId: e.actorId,
        action: e.action,
        count: 1,
        minute,
      });
      const added = day.rows[day.rows.length - 1];
      if (added) burst.push(added);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle", { name: school.name })}
      />
      {entries.length === 0 ? (
        <EmptyState
          icon={<ClockCounterClockwise weight="fill" />}
          titleAs="h2"
          title={t("none")}
          description={t("noneHint")}
        />
      ) : (
        <div className="space-y-8">
          <ul
            aria-label={t("legend")}
            className="flex flex-wrap items-center gap-2"
          >
            {(["create", "update", "remove"] as const).map((f) => (
              <li key={f}>
                <Badge variant={FAMILY[f].badge}>
                  {FAMILY[f].icon}
                  {t(`families.${f}`)}
                </Badge>
              </li>
            ))}
          </ul>
          {days.map((day) => (
            <section key={day.key} className="space-y-3">
              <h2 className="flex items-center gap-3 font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                <span className="first-letter:uppercase">{day.label}</span>
                <span aria-hidden className="h-px flex-1 bg-border" />
              </h2>
              <Card className="gap-0 px-3 py-2 sm:px-4">
                <ol className="relative">
                  {day.rows.map((r, i) => {
                    const family = FAMILY[familyOf(r.action)];
                    const label = t.has(`actions.${r.action}`)
                      ? t(`actions.${r.action}`)
                      : r.action;
                    return (
                      <li
                        key={r.id}
                        className="relative flex items-start gap-3 py-3"
                      >
                        {i < day.rows.length - 1 && (
                          <span
                            aria-hidden
                            className="absolute top-12 bottom-0 left-[18px] w-px bg-border"
                          />
                        )}
                        <span aria-hidden className="relative shrink-0">
                          {r.actor ? (
                            <PersonAvatar
                              name={r.actor}
                              seed={r.actorId ?? r.actor}
                              size="lg"
                              decorative
                              className="size-9"
                            />
                          ) : (
                            <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-4">
                              <Robot weight="fill" />
                            </span>
                          )}
                          <span
                            className={cn(
                              "absolute -right-1 -bottom-1 grid size-4.5 place-items-center rounded-full ring-2 ring-card [&_svg]:size-3",
                              family.dot,
                            )}
                          >
                            {family.icon}
                          </span>
                        </span>
                        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-1.5">
                          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <strong className="font-semibold">
                              {r.actor ?? t("system")}
                            </strong>
                            <Badge variant={family.badge}>{label}</Badge>
                            {r.count > 1 && (
                              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                                {t("times", { count: r.count })}
                              </span>
                            )}
                          </p>
                          <time
                            dateTime={r.at.toISOString()}
                            className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
                          >
                            {r.count > 1 && time(r.first) !== time(r.at)
                              ? `${time(r.first)} – ${time(r.at)}`
                              : time(r.at)}
                          </time>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
