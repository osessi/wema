import { ArrowLeft, UsersThree, VideoCamera } from "@phosphor-icons/react/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { load, serverApi } from "../../lib/api-server";
import { getSession } from "../../lib/session";
import { PageHeader } from "../page-header";
import { LocalDateTime } from "./local-time";
import { ReportForm, SessionActions, VisioPanel } from "./session-parts";
import { type AgendaSpace, SESSION_BASE, type SessionDetail } from "./types";

/**
 * La visio intégrée à la page demande que le web autorise le domaine Jitsi
 * (Content-Security-Policy `frame-src`, Permissions-Policy caméra et micro) :
 * voir docs/architecture.md. Sans cela, seule l'ouverture dans un onglet est
 * proposée.
 */
const EMBED = process.env.WEMA_VISIO_EMBED === "1";

/** Page d'une séance, commune aux espaces prof, élève et parent. */
export async function SessionPage({
  space,
  id,
}: {
  space: AgendaSpace;
  id: string;
}) {
  const t = await getTranslations("agenda");
  const format = await getFormatter();
  const api = await serverApi();
  const res = await api.agenda.sessions[":id"].$get({ param: { id } });
  if (res.status === 404 || res.status === 400) notFound();
  const detail: SessionDetail = await load(Promise.resolve(res));
  const { session, role, visio, can } = detail;
  const me = await getSession();

  const title =
    session.title ??
    (session.kind === "group" && session.groupName
      ? t("group", { name: session.groupName })
      : t("defaultTitle", {
          name:
            (role === "teacher" ? session.learnerName : session.teacherName) ??
            "",
        }));
  const ended = new Date(session.endsAt).getTime() <= Date.now();

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={SESSION_BASE[space]}>
          <ArrowLeft aria-hidden />
          {t("actions.back")}
        </Link>
      </Button>
      <PageHeader
        title={title}
        description={
          <LocalDateTime start={session.startsAt} end={session.endsAt} long />
        }
        actions={
          <Badge
            variant={session.status === "confirmed" ? "secondary" : "outline"}
          >
            {t(`status.${session.status}`)}
          </Badge>
        }
      />

      <SessionActions detail={detail} />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <VideoCamera aria-hidden />
              {t("detail.visio")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {visio ? (
              <VisioPanel
                visio={visio}
                displayName={me.user.displayName}
                embed={EMBED}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {ended ? t("detail.visioOver") : t("detail.visioLater")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersThree aria-hidden />
              {t("detail.who")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">
                {t("detail.teacher")} ·{" "}
              </span>
              {session.teacherName}
            </p>
            <ul className="space-y-1">
              {session.learners.map((l) => (
                <li key={l.userId}>{l.displayName}</li>
              ))}
            </ul>
            {session.requestNote && (
              <div className="space-y-1 border-t pt-3">
                <p className="text-muted-foreground">{t("detail.request")}</p>
                <p>« {session.requestNote} »</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("detail.report")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {session.report && (
            <div className="space-y-2">
              <p className="whitespace-pre-line">{session.report.summary}</p>
              {session.report.notions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm text-muted-foreground">
                    {t("detail.notions")} :
                  </span>
                  {session.report.notions.map((n) => (
                    <Badge key={n.id} variant="outline">
                      {n.name ?? "—"}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {t("detail.reportBy", {
                  date: format.dateTime(new Date(session.report.reportedAt), {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }),
                })}
              </p>
            </div>
          )}
          {can.report ? (
            <ReportForm detail={detail} />
          ) : (
            !session.report && (
              <p className="text-sm text-muted-foreground">
                {t("detail.noReport")}
              </p>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
