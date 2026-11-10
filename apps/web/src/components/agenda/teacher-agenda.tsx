"use client";

import {
  CalendarPlus,
  Clock,
  PencilSimple,
  Trash,
  UsersThree,
} from "@phosphor-icons/react";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { PersonAvatar } from "@wema/ui/components/wema/person-avatar";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { AgendaCalendar } from "./calendar";
import { formatClock } from "./dates";
import { LocalDateTime } from "./local-time";
import {
  AvailabilityDialog,
  GroupDialog,
  PlanSessionDialog,
  RescheduleDialog,
} from "./teacher-dialogs";
import { type Group, sessionHref, type TeacherData } from "./types";
import { useAgendaMutation } from "./use-agenda";

/** Agenda du prof : séances, demandes, disponibilités et groupes de révision. */
export function TeacherAgenda({
  data,
  stamp,
}: {
  data: TeacherData;
  stamp: number;
}) {
  const t = useTranslations("agenda");
  const days: string[] = t.raw("weekdaysLong");
  const format = useFormatter();
  // Date du calendrier (sans fuseau) : lue à midi UTC, affichée en UTC.
  const calendarDate = (d: string) =>
    format.dateTime(new Date(`${d}T12:00:00Z`), {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const [plan, setPlan] = useState<{ day: string; time: string } | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [moving, setMoving] = useState<TeacherData["pending"][number] | null>(
    null,
  );
  const { run, pending, error } = useAgendaMutation();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setPlan(null);
            setPlanOpen(true);
          }}
        >
          <CalendarPlus aria-hidden />
          {t("actions.plan")}
        </Button>
        <Button variant="outline" onClick={() => setRuleOpen(true)}>
          <Clock aria-hidden />
          {t("actions.addAvailability")}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setEditing(null);
            setGroupOpen(true);
          }}
        >
          <UsersThree aria-hidden />
          {t("actions.newGroup")}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {data.pending.length > 0 && (
        <Card tone="amber">
          <CardHeader>
            <CardTitle>{t("pending.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {data.pending.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <PersonAvatar
                      name={s.learnerName ?? s.groupName ?? ""}
                      seed={s.learnerIds[0] ?? s.id}
                      size="lg"
                      decorative
                    />
                    <div className="min-w-0 space-y-0.5">
                      <Link
                        href={sessionHref("teacher", s.id)}
                        className="font-medium hover:underline"
                      >
                        {s.learnerName ?? s.groupName}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        <LocalDateTime start={s.startsAt} end={s.endsAt} />
                      </p>
                      {s.requestNote && (
                        <p className="text-sm">« {s.requestNote} »</p>
                      )}
                    </div>
                  </div>
                  {s.status === "requested" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => run("POST", `/sessions/${s.id}/confirm`)}
                      >
                        {t("actions.confirm")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setMoving(s)}
                      >
                        {t("actions.reschedule")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => run("POST", `/sessions/${s.id}/decline`)}
                      >
                        {t("actions.decline")}
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="warning">
                      {t("pending.awaitingFamily")}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <AgendaCalendar
        space="teacher"
        stamp={stamp}
        onCreate={(day, time) => {
          setPlan({ day, time });
          setPlanOpen(true);
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("rules.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.rules.length === 0 ? (
              <EmptyState
                variant="inline"
                icon={<Clock weight="bold" />}
                tone="sky"
                titleAs="p"
                title={t("rules.empty")}
              />
            ) : (
              <ul className="divide-y">
                {data.rules.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="space-y-0.5 text-sm">
                      <p className="font-medium">
                        {t("rules.summary", {
                          days: r.weekdays
                            .map((d) => days[d - 1] ?? "")
                            .join(", "),
                          start: formatClock(r.startMinute),
                          end: formatClock(r.endMinute),
                        })}
                      </p>
                      <p className="text-muted-foreground">
                        {[
                          t("rules.every", { count: r.everyNWeeks }),
                          t("rules.from", {
                            date: calendarDate(r.validFrom),
                          }),
                          r.validUntil
                            ? t("rules.until", {
                                date: calendarDate(r.validUntil),
                              })
                            : null,
                          t("rules.slots", { minutes: r.slotMinutes }),
                          t("rules.zone", { zone: r.timeZone }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={pending}
                      aria-label={t("actions.delete")}
                      onClick={() => run("DELETE", `/availability/${r.id}`)}
                    >
                      <Trash aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("groups.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.groups.length === 0 ? (
              <EmptyState
                variant="inline"
                icon={<UsersThree weight="bold" />}
                tone="mint"
                titleAs="p"
                title={t("groups.empty")}
              />
            ) : (
              <ul className="divide-y">
                {data.groups.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 space-y-0.5 text-sm">
                      <p className="font-medium">{g.name}</p>
                      <p className="text-muted-foreground">
                        {g.notionName ?? t("groups.noNotion")} ·{" "}
                        {t("groups.members", { count: g.members.length })}
                      </p>
                      <p className="truncate text-muted-foreground">
                        {g.members.map((m) => m.displayName).join(", ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("actions.edit")}
                        onClick={() => {
                          setEditing(g);
                          setGroupOpen(true);
                        }}
                      >
                        <PencilSimple aria-hidden />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={pending}
                        aria-label={t("actions.archive")}
                        onClick={() => run("DELETE", `/groups/${g.id}`)}
                      >
                        <Trash aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <PlanSessionDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        learners={data.learners}
        groups={data.groups}
        initial={plan}
      />
      <AvailabilityDialog open={ruleOpen} onOpenChange={setRuleOpen} />
      <GroupDialog
        open={groupOpen}
        onOpenChange={setGroupOpen}
        learners={data.learners}
        notions={data.notions}
        group={editing}
      />
      {moving && (
        <RescheduleDialog
          open
          onOpenChange={(open) => !open && setMoving(null)}
          sessionId={moving.id}
          group={moving.kind === "group"}
          startsAt={moving.startsAt}
          endsAt={moving.endsAt}
        />
      )}
    </div>
  );
}
