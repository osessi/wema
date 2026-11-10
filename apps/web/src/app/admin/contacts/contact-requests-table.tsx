"use client";

import { CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Card } from "@wema/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wema/ui/components/ui/dialog";
import { toast } from "@wema/ui/components/ui/sonner";
import { PersonAvatar } from "@wema/ui/components/wema/person-avatar";
import { cn } from "@wema/ui/lib/utils";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import type { ContactRequestRow } from "../../../lib/contact-types";
import { useMutation } from "../../../lib/use-mutation";
import { Notice } from "../_ui/fields";
import { DefinitionList } from "../_ui/kit";

const PREVIEW_LENGTH = 110;

const preview = (message: string) =>
  message.length > PREVIEW_LENGTH
    ? `${message.slice(0, PREVIEW_LENGTH).trimEnd()}…`
    : message;

/** Boîte de réception : un clic sur une demande affiche le message complet. */
export function ContactRequestsTable({
  requests,
}: {
  requests: ContactRequestRow[];
}) {
  const t = useTranslations("contacts");
  const format = useFormatter();
  const { run, pending, error } = useMutation();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = requests.find((r) => r.id === openId) ?? null;

  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" });

  const markHandled = async (id: string) => {
    const result = await run("POST", `/admin/contact-requests/${id}/handled`);
    if (result.ok) toast.success(t("handledToast"));
  };

  const statusBadge = (r: ContactRequestRow) =>
    r.handledAt ? (
      <Badge variant="success">
        <CheckCircle aria-hidden weight="fill" />
        {t("handledShort")}
      </Badge>
    ) : (
      <Badge variant="warning">{t("pending")}</Badge>
    );

  return (
    <>
      <Card className="gap-0 overflow-hidden py-0">
        <ul className="divide-y">
          {requests.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                aria-label={t("open", { name: r.name })}
                onClick={() => setOpenId(r.id)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-6",
                  r.handledAt && "text-muted-foreground",
                )}
              >
                <PersonAvatar
                  name={r.name}
                  seed={r.id}
                  decorative
                  className={cn("mt-0.5", r.handledAt && "opacity-60")}
                />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={cn(
                        "truncate text-sm",
                        r.handledAt
                          ? "font-medium"
                          : "font-semibold text-foreground",
                      )}
                    >
                      {r.name}
                    </span>
                    <Badge variant="neutral">
                      {t(`profiles.${r.profile}`)}
                    </Badge>
                    {r.organization ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {r.organization}
                      </span>
                    ) : null}
                  </span>
                  <span className="line-clamp-2 block text-sm text-muted-foreground">
                    {preview(r.message)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <time
                    dateTime={r.createdAt}
                    className="text-xs text-muted-foreground tabular-nums"
                  >
                    {date(r.createdAt)}
                  </time>
                  {statusBadge(r)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Dialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
      >
        {open ? (
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {open.name}
                {statusBadge(open)}
              </DialogTitle>
              <DialogDescription>{date(open.createdAt)}</DialogDescription>
            </DialogHeader>
            <DefinitionList
              className="grid-cols-[minmax(0,7rem)_minmax(0,1fr)]"
              items={[
                {
                  key: "email",
                  label: t("email"),
                  value: (
                    <a
                      className="underline-offset-4 hover:underline"
                      href={`mailto:${open.email}`}
                    >
                      {open.email}
                    </a>
                  ),
                },
                {
                  key: "profile",
                  label: t("profile"),
                  value: t(`profiles.${open.profile}`),
                },
                {
                  key: "org",
                  label: t("organization"),
                  value: open.organization ?? "—",
                },
                ...(open.handledAt
                  ? [
                      {
                        key: "handled",
                        label: t("status"),
                        value: t("handled", { date: date(open.handledAt) }),
                      },
                    ]
                  : []),
              ]}
            />
            <p className="max-h-[45vh] overflow-y-auto rounded-card border bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {open.message}
            </p>
            {error ? <Notice tone="error">{error}</Notice> : null}
            <DialogFooter>
              {open.handledAt ? null : (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => void markHandled(open.id)}
                >
                  <CheckCircle aria-hidden />
                  {t("markHandled")}
                </Button>
              )}
              <Button asChild>
                <a href={`mailto:${open.email}`}>
                  <PaperPlaneTilt aria-hidden />
                  {t("reply")}
                </a>
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
