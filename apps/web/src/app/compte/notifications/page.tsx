import { Badge } from "@wema/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { PreferencesForm } from "./preferences-form";

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
      <Card>
        <CardHeader>
          <CardTitle>{t("history.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {settings.deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("history.empty")}
            </p>
          ) : (
            <ul className="divide-y">
              {settings.deliveries.map((d) => (
                <li key={d.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{t(`history.kind.${d.kind}`)}</span>
                    <span aria-hidden>·</span>
                    <span>{t(`channels.${d.channel}`)}</span>
                    <span aria-hidden>·</span>
                    <time dateTime={d.createdAt}>
                      {format.dateTime(new Date(d.createdAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: tz,
                      })}
                    </time>
                    <Badge
                      variant={d.status === "sent" ? "secondary" : "outline"}
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
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
