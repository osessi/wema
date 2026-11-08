"use client";

import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Card, CardContent } from "@wema/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wema/ui/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import type { ContactRequestRow } from "../../../lib/contact-types";
import { useMutation } from "../../../lib/use-mutation";
import { Notice } from "../_ui/fields";

const PREVIEW_LENGTH = 80;

const preview = (message: string) =>
  message.length > PREVIEW_LENGTH
    ? `${message.slice(0, PREVIEW_LENGTH).trimEnd()}…`
    : message;

/** Tableau des demandes ; un clic sur une ligne affiche le message complet. */
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

  const markHandled = (id: string) =>
    run("POST", `/admin/contact-requests/${id}/handled`);

  const status = (r: ContactRequestRow) =>
    r.handledAt ? (
      <Badge variant="outline">
        {t("handled", { date: date(r.handledAt) })}
      </Badge>
    ) : (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={(e) => {
          // Le bouton est dans la ligne : ne pas ouvrir le message.
          e.stopPropagation();
          void markHandled(r.id);
        }}
      >
        {t("markHandled")}
      </Button>
    );

  return (
    <>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Card className="py-0">
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("profile")}</TableHead>
                <TableHead>{t("organization")}</TableHead>
                <TableHead>{t("message")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow
                  key={r.id}
                  tabIndex={0}
                  aria-label={t("open", { name: r.name })}
                  className={`cursor-pointer align-top ${r.handledAt ? "text-muted-foreground" : ""}`}
                  onClick={() => setOpenId(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenId(r.id);
                    }
                  }}
                >
                  <TableCell className="whitespace-nowrap">
                    {date(r.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>{t(`profiles.${r.profile}`)}</TableCell>
                  <TableCell>{r.organization ?? "—"}</TableCell>
                  <TableCell className="max-w-[320px] whitespace-normal">
                    {preview(r.message)}
                  </TableCell>
                  <TableCell>{status(r)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
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
              <DialogTitle>{open.name}</DialogTitle>
              <DialogDescription>
                {[
                  date(open.createdAt),
                  t(`profiles.${open.profile}`),
                  open.organization,
                ]
                  .filter((part) => part)
                  .join(" · ")}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm">
              <a
                className="text-primary underline-offset-4 hover:underline"
                href={`mailto:${open.email}`}
              >
                {open.email}
              </a>
            </p>
            <p className="max-h-[50vh] overflow-y-auto text-sm whitespace-pre-wrap">
              {open.message}
            </p>
            <DialogFooter>
              {open.handledAt ? (
                <Badge variant="outline">
                  {t("handled", { date: date(open.handledAt) })}
                </Badge>
              ) : (
                <Button
                  disabled={pending}
                  onClick={() => void markHandled(open.id)}
                >
                  {t("markHandled")}
                </Button>
              )}
              <Button variant="outline" asChild>
                <a href={`mailto:${open.email}`}>{t("reply")}</a>
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
