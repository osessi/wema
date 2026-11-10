import {
  BookOpenText,
  Buildings,
  Info,
  Receipt,
  SealCheck,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import { GlowTile, type GlowTone } from "@wema/ui/components/brand/glow-tile";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Badge } from "@wema/ui/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { CancelButton } from "./cancel-button";
import { formatAmount, formatDate } from "./format";
import { SubscribeForm } from "./subscribe-form";

type Status = "success" | "warning" | "danger" | "info" | "neutral";

const SUBSCRIPTION_BADGE: Record<string, Status> = {
  trialing: "info",
  active: "success",
  past_due: "warning",
  canceled: "danger",
  ended: "neutral",
};

const PAYMENT_BADGE: Record<string, Status> = {
  pending: "warning",
  succeeded: "success",
  failed: "danger",
};

const SUBJECT_TONES: GlowTone[] = ["yellow", "sky", "mint", "rose", "amber"];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("parent.title")}
        description={t("parent.subtitle")}
      />
      {annule ? (
        <Alert variant="warning">
          <Info aria-hidden />
          <AlertDescription>{t("parent.canceledNotice")}</AlertDescription>
        </Alert>
      ) : null}
      {data.children.length === 0 ? (
        <EmptyState
          icon={<UsersThree weight="bold" />}
          tone="yellow"
          titleAs="h2"
          title={t("parent.empty")}
        />
      ) : (
        data.children.map((child) => (
          <section
            key={child.learnerId}
            aria-labelledby={`child-${child.learnerId}`}
            className="flex flex-col gap-5 rounded-card border bg-card p-4 shadow-xs sm:p-6"
          >
            <header className="flex flex-wrap items-center gap-3">
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-ink-on-brand"
              >
                {initials(child.displayName)}
              </span>
              <h2
                id={`child-${child.learnerId}`}
                className="min-w-0 flex-1 truncate text-xl font-normal tracking-tight"
              >
                {child.displayName}
              </h2>
              {child.underContract ? (
                <Badge variant="success">
                  <SealCheck aria-hidden weight="bold" />
                  {t("parent.included")}
                </Badge>
              ) : null}
            </header>
            {child.underContract ? (
              <div className="flex items-center gap-3 rounded-[10px] bg-success-soft/60 p-3 text-sm">
                <GlowTile tone="mint" size={32}>
                  <Buildings weight="bold" />
                </GlowTile>
                <p>{t("parent.contract")}</p>
              </div>
            ) : null}
            {/* Sous contrat, toutes les matières sont incluses : la liste
                vide « Aucune matière » contredirait le bandeau. */}
            {child.underContract && child.subscriptions.length === 0 ? null : (
              <div className="flex flex-col gap-3">
                <h3 className="font-mono text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  {t("parent.current")}
                </h3>
                {child.subscriptions.length === 0 ? (
                  <p className="rounded-[10px] border border-dashed px-4 py-3 text-center text-sm text-muted-foreground">
                    {t("parent.none")}
                  </p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {child.subscriptions.map((s, i) => {
                      const until =
                        s.status === "trialing"
                          ? s.trialEndsAt
                          : s.currentPeriodEnd;
                      return (
                        <li
                          key={s.id}
                          className="flex h-full flex-col gap-4 rounded-card border bg-background/60 p-4"
                        >
                          <div className="flex items-center gap-3">
                            <GlowTile
                              tone={
                                SUBJECT_TONES[i % SUBJECT_TONES.length] ??
                                "yellow"
                              }
                              size={36}
                            >
                              <BookOpenText weight="bold" />
                            </GlowTile>
                            <p className="min-w-0 flex-1 truncate font-medium">
                              {s.subjectName}
                            </p>
                          </div>
                          <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                            <Badge
                              variant={
                                s.open
                                  ? SUBSCRIPTION_BADGE[s.status]
                                  : "neutral"
                              }
                            >
                              {s.open
                                ? t(`status.${s.status}`, {
                                    date: formatDate(until),
                                  })
                                : t("status.expired")}
                            </Badge>
                            {s.cancelable ? (
                              <CancelButton subscriptionId={s.id} />
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
            {child.underContract ? null : (
              <SubscribeForm child={child} offers={data.offers} />
            )}
          </section>
        ))
      )}
      <section
        aria-labelledby="history-title"
        className="flex flex-col gap-4 rounded-card border bg-card p-4 shadow-xs sm:p-6"
      >
        <div className="flex items-center gap-3">
          <GlowTile tone="slate" size={36}>
            <Receipt weight="bold" />
          </GlowTile>
          <h2 id="history-title" className="text-lg font-normal tracking-tight">
            {t("parent.historyTitle")}
          </h2>
        </div>
        {data.payments.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<Receipt weight="bold" />}
            title={t("parent.historyEmpty")}
            titleAs="p"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("parent.date")}</TableHead>
                  <TableHead>{t("parent.child")}</TableHead>
                  <TableHead>{t("parent.subject")}</TableHead>
                  <TableHead>{t("parent.method")}</TableHead>
                  <TableHead>{t("parent.statusLabel")}</TableHead>
                  <TableHead className="text-right">
                    {t("parent.amount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="tabular-nums">
                      {formatDate(p.paidAt ?? p.createdAt)}
                    </TableCell>
                    <TableCell>{p.learnerName}</TableCell>
                    <TableCell>{p.subjectName}</TableCell>
                    <TableCell>{t(`methods.${p.method}`)}</TableCell>
                    <TableCell>
                      <Badge variant={PAYMENT_BADGE[p.status]}>
                        {t(`paymentStatus.${p.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatAmount(p.amountMinor, p.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
