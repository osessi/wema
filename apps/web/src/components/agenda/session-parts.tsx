"use client";

import { ArrowSquareOut, VideoCamera } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { Checkbox } from "@wema/ui/components/ui/checkbox";
import { Label } from "@wema/ui/components/ui/label";
import { Textarea } from "@wema/ui/components/ui/textarea";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { RescheduleDialog } from "./teacher-dialogs";
import type { SessionDetail } from "./types";
import { useAgendaMutation } from "./use-agenda";

/** Boutons d'action d'une séance, selon ce que l'API permet à la personne. */
export function SessionActions({ detail }: { detail: SessionDetail }) {
  const t = useTranslations("agenda");
  const { run, pending, error } = useAgendaMutation();
  const [moving, setMoving] = useState(false);
  const { session, can } = detail;
  const act = (action: string) =>
    run("POST", `/sessions/${session.id}/${action}`);
  if (
    !(can.confirm || can.accept || can.reschedule || can.decline || can.cancel)
  )
    return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {can.confirm && (
          <Button disabled={pending} onClick={() => act("confirm")}>
            {t("actions.confirm")}
          </Button>
        )}
        {can.accept && (
          <Button disabled={pending} onClick={() => act("accept")}>
            {t("actions.accept")}
          </Button>
        )}
        {can.reschedule && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setMoving(true)}
          >
            {t(
              session.kind === "group"
                ? "actions.rescheduleGroup"
                : "actions.reschedule",
            )}
          </Button>
        )}
        {can.decline && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => act("decline")}
          >
            {t("actions.decline")}
          </Button>
        )}
        {can.cancel && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (window.confirm(t("confirmCancel"))) act("cancel");
            }}
          >
            {t("actions.cancel")}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {can.reschedule && (
        <RescheduleDialog
          open={moving}
          onOpenChange={setMoving}
          sessionId={session.id}
          group={session.kind === "group"}
          startsAt={session.startsAt}
          endsAt={session.endsAt}
        />
      )}
    </div>
  );
}

/**
 * Salle de visio Jitsi Meet : ouverture dans un nouvel onglet (toujours
 * possible) ou intégrée à la page quand le web l'autorise (`embed`).
 */
export function VisioPanel({
  visio,
  displayName,
  embed,
}: {
  visio: NonNullable<SessionDetail["visio"]>;
  displayName: string;
  embed: boolean;
}) {
  const t = useTranslations("agenda.detail");
  const [shown, setShown] = useState(false);
  // Réglages passés dans l'adresse : pas d'enregistrement ni de diffusion.
  const config = [
    "config.fileRecordingsEnabled=false",
    "config.liveStreamingEnabled=false",
    "config.localRecording.disable=true",
    "config.transcription.enabled=false",
    `userInfo.displayName=${encodeURIComponent(JSON.stringify(displayName))}`,
  ].join("&");
  const url = `${visio.url}#${config}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <VideoCamera aria-hidden />
            {t("join")}
            <ArrowSquareOut aria-hidden />
          </a>
        </Button>
        {embed && (
          <Button variant="outline" onClick={() => setShown((v) => !v)}>
            {shown ? t("hideHere") : t("showHere")}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t("joinHint")}</p>
      {embed && shown && (
        <iframe
          src={url}
          title={t("visio")}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="aspect-video w-full rounded-xl border bg-muted"
        />
      )}
    </div>
  );
}

/** Compte rendu du prof : quelques lignes et les notions travaillées. */
export function ReportForm({ detail }: { detail: SessionDetail }) {
  const t = useTranslations("agenda.reportForm");
  const { run, pending, error } = useAgendaMutation();
  const id = useId();
  const report = detail.session.report;
  const [summary, setSummary] = useState(report?.summary ?? "");
  const initial = report
    ? report.notions.map((n) => n.id)
    : detail.session.groupNotionId
      ? [detail.session.groupNotionId]
      : [];
  const [notions, setNotions] = useState<Set<string>>(new Set(initial));
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const result = await run("POST", `/sessions/${detail.session.id}/report`, {
      summary: summary.trim(),
      notionIds: [...notions],
    });
    if (result.ok) setSaved(true);
  }

  const toggle = (nid: string, on: boolean) => {
    const next = new Set(notions);
    if (on) next.add(nid);
    else next.delete(nid);
    setNotions(next);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <div className="space-y-2">
        <Label htmlFor={id}>{t("summary")}</Label>
        <Textarea
          id={id}
          value={summary}
          required
          maxLength={1000}
          rows={4}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>
      {detail.notions.length > 0 && (
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">{t("notions")}</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {detail.notions.map((n) => {
              const cid = `n-${n.id}`;
              return (
                <div key={n.id} className="flex items-center gap-2">
                  <Checkbox
                    id={cid}
                    checked={notions.has(n.id)}
                    onCheckedChange={(v) => toggle(n.id, v === true)}
                  />
                  <Label htmlFor={cid} className="font-normal">
                    {n.name}
                    <span className="text-muted-foreground">
                      {" "}
                      · {n.className}
                    </span>
                  </Label>
                </div>
              );
            })}
          </div>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !summary.trim()}>
          {t("submit")}
        </Button>
        {saved && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("saved")}
          </p>
        )}
      </div>
    </form>
  );
}
