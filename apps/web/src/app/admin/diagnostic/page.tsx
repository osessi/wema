import { CalendarBlank, Clock, Handshake } from "@phosphor-icons/react/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { PersonChip } from "@wema/ui/components/wema/person-avatar";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LocalDateTime } from "../../../components/agenda/local-time";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { hasPermission } from "../../../lib/session";
import { Panel } from "../_ui/kit";
import { AdvisorAvailability } from "./advisor-availability";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("diagnostic");
  return { title: t("title") };
}

/** Espace du conseiller Wema : ses rendez-vous de diagnostic et ses disponibilités. */
export default async function AdvisorPage() {
  if (!(await hasPermission("diagnostic.conduct"))) notFound();
  const t = await getTranslations("diagnostic");
  const api = await serverApi();
  const data = await load(api.diagnostic.advisor.$get());
  const now = Date.now();
  const upcoming = data.appointments
    .filter((a) => a.status === "booked")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = data.appointments.filter((a) => a.status !== "booked");

  const list = (items: typeof data.appointments) => (
    <ul className="flex flex-col divide-y overflow-hidden rounded-card border bg-card shadow-xs">
      {items.map((a) => (
        <li
          key={a.id}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <PersonChip
            name={a.learnerName}
            seed={a.learnerId}
            meta={<LocalDateTime start={a.startsAt} end={a.endsAt} />}
          />
          <div className="flex items-center gap-2">
            <Badge
              variant={
                a.status === "done"
                  ? "success"
                  : a.status === "cancelled"
                    ? "neutral"
                    : new Date(a.startsAt).getTime() <= now
                      ? "warning"
                      : "info"
              }
            >
              {t(`status.${a.status}`)}
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/diagnostic/${a.id}`}>{t("list.open")}</Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Panel
        icon={<Handshake weight="bold" />}
        tone="yellow"
        title={t("list.title")}
      >
        {data.appointments.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<CalendarBlank weight="bold" />}
            illustration="drawer"
            title={t("list.empty")}
            titleAs="p"
          />
        ) : (
          <div className="flex flex-col gap-4">
            {upcoming.length > 0 ? list(upcoming) : null}
            {past.length > 0 ? list(past) : null}
          </div>
        )}
      </Panel>
      <Panel
        icon={<Clock weight="bold" />}
        tone="sky"
        title={t("availability.title")}
        description={t("availability.text", { minutes: data.minutes })}
      >
        <AdvisorAvailability rules={data.rules} />
      </Panel>
    </>
  );
}
