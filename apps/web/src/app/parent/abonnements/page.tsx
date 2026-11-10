import { Badge } from "@wema/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { CancelButton } from "./cancel-button";
import { formatAmount, formatDate } from "./format";
import { SubscribeForm } from "./subscribe-form";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ annule?: string }>;
}) {
  const t = await getTranslations("billing");
  const { annule } = await searchParams;
  const api = await serverApi();
  const data = await load(api.parent.billing.$get());
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("parent.title")}
        description={t("parent.subtitle")}
      />
      {annule ? (
        <p className="rounded-lg border bg-card p-4 text-sm">
          {t("parent.canceledNotice")}
        </p>
      ) : null}
      {data.children.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">
          {t("parent.empty")}
        </p>
      ) : (
        data.children.map((child) => (
          <Card key={child.learnerId}>
            <CardHeader>
              <CardTitle className="font-display text-xl">
                {child.displayName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {child.underContract ? (
                <p className="rounded-md bg-muted p-3 text-sm">
                  {t("parent.contract")}
                </p>
              ) : null}
              {/* Sous contrat, toutes les matières sont incluses : la liste
                  vide « Aucune matière » contredirait le bandeau. */}
              {child.underContract &&
              child.subscriptions.length === 0 ? null : (
                <section className="space-y-2">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {t("parent.current")}
                  </h2>
                  {child.subscriptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("parent.none")}
                    </p>
                  ) : (
                    <ul className="divide-y rounded-md border">
                      {child.subscriptions.map((s) => {
                        const until =
                          s.status === "trialing"
                            ? s.trialEndsAt
                            : s.currentPeriodEnd;
                        return (
                          <li
                            key={s.id}
                            className="flex flex-wrap items-center justify-between gap-3 p-3"
                          >
                            <div className="space-y-1">
                              <p className="font-medium">{s.subjectName}</p>
                              <Badge variant={s.open ? "secondary" : "outline"}>
                                {s.open
                                  ? t(`status.${s.status}`, {
                                      date: formatDate(until),
                                    })
                                  : t("status.expired")}
                              </Badge>
                            </div>
                            {s.cancelable ? (
                              <CancelButton subscriptionId={s.id} />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}
              {child.underContract ? null : (
                <SubscribeForm child={child} offers={data.offers} />
              )}
            </CardContent>
          </Card>
        ))
      )}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">
            {t("parent.historyTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("parent.historyEmpty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("parent.date")}</TableHead>
                  <TableHead>{t("parent.child")}</TableHead>
                  <TableHead>{t("parent.subject")}</TableHead>
                  <TableHead>{t("parent.amount")}</TableHead>
                  <TableHead>{t("parent.method")}</TableHead>
                  <TableHead>{t("parent.statusLabel")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.paidAt ?? p.createdAt)}</TableCell>
                    <TableCell>{p.learnerName}</TableCell>
                    <TableCell>{p.subjectName}</TableCell>
                    <TableCell>
                      {formatAmount(p.amountMinor, p.currency)}
                    </TableCell>
                    <TableCell>{t(`methods.${p.method}`)}</TableCell>
                    <TableCell>{t(`paymentStatus.${p.status}`)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
