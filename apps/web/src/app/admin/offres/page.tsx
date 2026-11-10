import {
  Buildings,
  CreditCard,
  DeviceMobile,
  Handshake,
  Receipt,
  Tag,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { GlowTile } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import { Card } from "@wema/ui/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { PersonChip } from "@wema/ui/components/wema/person-avatar";
import { SubjectLabel } from "@wema/ui/components/wema/subject-icon";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { formatAmount, formatDate } from "../../parent/abonnements/format";
import { MonoLabel, Panel } from "../_ui/kit";
import { ContractSwitch } from "./contract-switch";
import { NewOfferDialog, OfferEdit } from "./offer-row-edit";
import { SessionPrices } from "./session-prices";

const METHODS = [
  { key: "card", Icon: CreditCard, tone: "sky" },
  { key: "mobile_money", Icon: DeviceMobile, tone: "mint" },
] as const;

const SUBSCRIPTION_BADGE = {
  trialing: "info",
  active: "success",
  past_due: "danger",
  canceled: "warning",
  ended: "neutral",
  expired: "neutral",
} as const;

const PAYMENT_BADGE = {
  pending: "warning",
  succeeded: "success",
  failed: "danger",
} as const;

/** Back-office du paiement : offres par pays et matière, contrats, abonnements, paiements. */
export default async function Page() {
  const t = await getTranslations("billing");
  const tx = await getTranslations("billingAdmin");
  const api = await serverApi();
  const [offers, activity, contracts, sessionPrices] = await Promise.all([
    load(api.admin.billing.offers.$get()),
    load(api.admin.billing.subscriptions.$get()),
    load(api.admin.billing.contracts.$get()),
    load(api.admin.billing["session-prices"].$get()),
  ]);
  const available: readonly string[] = offers.methods;
  // Les paiements ne portent que le nom de la matière : icône retrouvée par le nom.
  const iconByName = new Map<string, string | null>(
    offers.offers.map((o) => [o.subjectName, o.subjectIcon]),
  );
  const newOffer = (
    <NewOfferDialog
      countries={offers.countries}
      subjects={offers.subjects}
      available={available}
    />
  );
  return (
    <>
      <PageHeader title={t("admin.title")} description={t("admin.subtitle")} />

      <section aria-labelledby="pay-methods" className="space-y-3">
        <MonoLabel>
          <span id="pay-methods">{t("admin.providersTitle")}</span>
        </MonoLabel>
        <ul className="grid gap-3 sm:grid-cols-2">
          {METHODS.map((m) => {
            const on = available.includes(m.key);
            return (
              <li key={m.key}>
                <Card className="h-full flex-row flex-wrap items-center gap-3 p-4">
                  <GlowTile tone={on ? m.tone : "slate"} size={40}>
                    <m.Icon weight="fill" />
                  </GlowTile>
                  <span className="min-w-[min(100%,12rem)] flex-1 space-y-0.5">
                    <span className="block text-sm font-semibold">
                      {t(`methods.${m.key}`)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {on ? tx("pluggedHint") : tx("notPluggedHint")}
                    </span>
                  </span>
                  <Badge variant={on ? "success" : "neutral"}>
                    <span
                      aria-hidden
                      className={`size-1.5 rounded-full ${on ? "bg-current" : "bg-muted-foreground/60"}`}
                    />
                    {on ? tx("plugged") : tx("notPlugged")}
                  </Badge>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <Panel
        icon={<Tag weight="fill" />}
        tone="amber"
        title={
          <span className="flex items-center gap-2">
            {t("admin.offers")}
            <Badge variant="neutral" className="tabular-nums">
              {offers.offers.length}
            </Badge>
          </span>
        }
        description={tx("offersHint")}
        actions={newOffer}
        flush={offers.offers.length > 0}
      >
        {offers.offers.length === 0 ? (
          <EmptyState
            variant="inline"
            // Figure en clair : ILLUSTRATION_FOR vit dans un module client.
            illustration="basket"
            title={tx("noOffers")}
            titleAs="p"
            description={tx("noOffersAction")}
          />
        ) : (
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("admin.subject")}</TableHead>
                <TableHead>{t("admin.country")}</TableHead>
                <TableHead className="text-right">{t("admin.price")}</TableHead>
                <TableHead className="text-right">{t("admin.trial")}</TableHead>
                <TableHead>{t("admin.methods")}</TableHead>
                <TableHead>{t("admin.state")}</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">{t("admin.edit")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.offers.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    <SubjectLabel icon={o.subjectIcon}>
                      {o.subjectName}
                    </SubjectLabel>
                  </TableCell>
                  <TableCell>{o.countryName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="font-medium">
                      {formatAmount(o.amountMinor, o.currency)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {o.intervalMonths === 1
                        ? tx("perMonth")
                        : tx("perMonths", { months: o.intervalMonths })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.trialDays > 0 ? (
                      t("admin.trialValue", { days: o.trialDays })
                    ) : (
                      <span className="text-muted-foreground">
                        {t("admin.trialNone")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1.5">
                      {o.methods.map((m) => (
                        <Badge
                          key={m}
                          variant={available.includes(m) ? "info" : "warning"}
                          title={
                            available.includes(m)
                              ? undefined
                              : tx("methodNotPlugged")
                          }
                        >
                          {t(`methods.${m}`)}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={o.active ? "success" : "neutral"}>
                      {o.active ? t("admin.active") : t("admin.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <OfferEdit offer={o} available={available} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <SessionPrices
        prices={sessionPrices.prices}
        countries={sessionPrices.countries}
        available={available}
      />

      <Panel
        icon={<Handshake weight="fill" />}
        tone="mint"
        title={t("admin.contracts")}
        description={t("admin.contractsHint")}
        flush={contracts.organizations.length > 0}
      >
        {contracts.organizations.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<Buildings weight="fill" />}
            tone="mint"
            title={t("admin.noContracts")}
            titleAs="p"
          />
        ) : (
          <ul className="divide-y">
            {contracts.organizations.map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-3 px-4 py-3 sm:px-6"
              >
                <GlowTile tone={o.kind === "school" ? "sky" : "mint"} size={32}>
                  {o.kind === "school" ? (
                    <Buildings weight="fill" />
                  ) : (
                    <UsersThree weight="fill" />
                  )}
                </GlowTile>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {o.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`admin.kinds.${o.kind}`)}
                  </span>
                </span>
                <Badge variant={o.underContract ? "success" : "neutral"}>
                  {o.underContract
                    ? t("admin.underContract")
                    : tx("noContract")}
                </Badge>
                <ContractSwitch
                  organizationId={o.id}
                  name={o.name}
                  underContract={o.underContract}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        icon={<UsersThree weight="fill" />}
        tone="sky"
        title={t("admin.subscriptions")}
        description={tx("subscriptionsHint")}
        flush={activity.subscriptions.length > 0}
      >
        {activity.subscriptions.length === 0 ? (
          <EmptyState
            variant="inline"
            illustration="drawer"
            title={t("admin.noSubscriptions")}
            titleAs="p"
          />
        ) : (
          <Table className="min-w-[680px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("admin.learner")}</TableHead>
                <TableHead>{t("admin.subject")}</TableHead>
                <TableHead>{t("admin.payer")}</TableHead>
                <TableHead>{t("admin.provider")}</TableHead>
                <TableHead>{t("admin.statusLabel")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.subscriptions.map((s) => {
                const status = s.open
                  ? s.status
                  : s.status === "ended"
                    ? "ended"
                    : "expired";
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <PersonChip
                        name={s.learnerName}
                        seed={s.learnerId}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell>
                      <SubjectLabel icon={s.subjectIcon}>
                        {s.subjectName}
                      </SubjectLabel>
                    </TableCell>
                    <TableCell>
                      {s.payerName ? (
                        <PersonChip name={s.payerName} size="sm" />
                      ) : (
                        "–"
                      )}
                    </TableCell>
                    <TableCell>
                      {s.provider ? t(`providers.${s.provider}`) : "–"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={SUBSCRIPTION_BADGE[status]}>
                        {s.open
                          ? t(`status.${s.status}`, {
                              date: formatDate(
                                s.status === "trialing"
                                  ? s.trialEndsAt
                                  : s.currentPeriodEnd,
                              ),
                            })
                          : t(`status.${status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Panel
        icon={<Receipt weight="fill" />}
        tone="amber"
        title={t("admin.payments")}
        description={tx("paymentsHint")}
        flush={activity.payments.length > 0}
      >
        {activity.payments.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<Receipt weight="fill" />}
            tone="amber"
            title={t("admin.noPayments")}
            titleAs="p"
          />
        ) : (
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("admin.date")}</TableHead>
                <TableHead>{t("admin.learner")}</TableHead>
                <TableHead>{t("admin.subject")}</TableHead>
                <TableHead className="text-right">
                  {t("parent.amount")}
                </TableHead>
                <TableHead>{t("admin.provider")}</TableHead>
                <TableHead>{t("admin.kind")}</TableHead>
                <TableHead>{t("admin.statusLabel")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatDate(p.paidAt ?? p.createdAt)}
                  </TableCell>
                  <TableCell>
                    <PersonChip name={p.learnerName} size="sm" />
                  </TableCell>
                  <TableCell>
                    <SubjectLabel icon={iconByName.get(p.subjectName)}>
                      {p.subjectName}
                    </SubjectLabel>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatAmount(p.amountMinor, p.currency)}
                  </TableCell>
                  <TableCell>{t(`providers.${p.provider}`)}</TableCell>
                  <TableCell>
                    {p.kind === "renewal"
                      ? t("admin.kindRenewal")
                      : t("admin.kindInitial")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={PAYMENT_BADGE[p.status]}>
                      {t(`paymentStatus.${p.status}`)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
