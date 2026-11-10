import {
  Bell,
  ChatCircleDots,
  ClockCountdown,
  PaperPlaneTilt,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { Panel } from "../../admin/_ui/kit";
import { PreferencesForm } from "./preferences-form";

const STATUS_BADGE = {
  pending: "warning",
  sent: "success",
  failed: "danger",
  cancelled: "neutral",
} as const;
const KIND_ICON = {
  nudge: Bell,
  message: ChatCircleDots,
  session_reminder: ClockCountdown,
} as const;

export default async function NotificationsPage() {
  const api = await serverApi();
  const settings = await load(api.notifications.$get());
  const t = await getTranslations("notifications");
  const format = await getFormatter();
  const tz = settings.preferences.timeZone ?? "UTC";
  const audience = settings.audience;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t(`description.${audience}`)}
      />
      <PreferencesForm settings={settings} />
      <Panel
        icon={<PaperPlaneTilt weight="fill" />}
        tone="mint"
        title={t("history.title")}
        flush={settings.deliveries.length > 0}
      >
        {settings.deliveries.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<PaperPlaneTilt weight="fill" />}
            tone="mint"
            title={t("history.empty")}
            titleAs="p"
          />
        ) : (
          <ul className="divide-y">
            {settings.deliveries.map((d) => {
              const Icon = KIND_ICON[d.kind];
              return (
                <li key={d.id} className="flex gap-3 px-4 py-3 sm:px-6">
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {t(`history.kind.${d.kind}`)}
                      </span>
                      <span aria-hidden>·</span>
                      <span>{t(`channels.${d.channel}`)}</span>
                      <span aria-hidden>·</span>
                      <time dateTime={d.createdAt} className="tabular-nums">
                        {format.dateTime(new Date(d.createdAt), {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: tz,
                        })}
                      </time>
                      <Badge
                        variant={STATUS_BADGE[d.status]}
                        className="ml-auto"
                      >
                        {t(`history.status.${d.status}`)}
                      </Badge>
                    </div>
                    <p className="text-sm">{d.body}</p>
                    {d.status === "pending" && (
                      <p className="text-xs text-muted-foreground">
                        {t("history.waitingUntil", {
                          date: format.dateTime(new Date(d.notBefore), {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: tz,
                          }),
                        })}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
