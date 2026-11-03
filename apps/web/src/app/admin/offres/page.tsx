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
import { formatAmount, formatDate } from "../../parent/abonnements/format";
import { EmptyState } from "../_ui/fields";
import { ContractSwitch } from "./contract-switch";
import { OfferForm } from "./offer-form";
import { OfferEdit } from "./offer-row-edit";

const METHODS = ["card", "mobile_money"] as const;

/** Back-office du paiement : offres par pays et matière, contrats, abonnements, paiements. */
export default async function Page() {
  const t = await getTranslations("billing");
  const api = await serverApi();
  const [offers, activity, contracts] = await Promise.all([
    load(api.admin.billing.offers.$get()),
    load(api.admin.billing.subscriptions.$get()),
    load(api.admin.billing.contracts.$get()),
  ]);
  return (
    <>
      <PageHeader title={t("admin.title")} description={t("admin.subtitle")} />
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">
            {t("admin.providersTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <Badge
              key={m}
              variant={offers.methods.includes(m) ? "secondary" : "outline"}
            >
              {t(`methods.${m}`)}
              {offers.methods.includes(m)
                ? ""
                : ` · ${t("admin.notConfigured")}`}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">
            {t("admin.offers")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {offers.offers.length === 0 ? (
            <EmptyState>{t("admin.noOffers")}</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.country")}</TableHead>
                  <TableHead>{t("admin.subject")}</TableHead>
                  <TableHead>{t("admin.price")}</TableHead>
                  <TableHead>{t("admin.trial")}</TableHead>
                  <TableHead>{t("admin.methods")}</TableHead>
                  <TableHead>{t("admin.state")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.offers.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{o.countryName}</TableCell>
                    <TableCell>{o.subjectName}</TableCell>
                    <TableCell>
                      {o.intervalMonths === 1
                        ? t("price.month", {
                            amount: formatAmount(o.amountMinor, o.currency),
                          })
                        : t("price.months", {
                            amount: formatAmount(o.amountMinor, o.currency),
                            months: o.intervalMonths,
                          })}
                    </TableCell>
                    <TableCell>
                      {o.trialDays > 0
                        ? t("admin.trialValue", { days: o.trialDays })
                        : t("admin.trialNone")}
                    </TableCell>
                    <TableCell>
                      {o.methods.map((m) => t(`methods.${m}`)).join(", ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={o.active ? "default" : "outline"}>
                        {o.active ? t("admin.active") : t("admin.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <OfferEdit offer={o} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">
            {t("admin.newOffer")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OfferForm countries={offers.countries} subjects={offers.subjects} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">
            {t("admin.contracts")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("admin.contractsHint")}
          </p>
        </CardHeader>
        <CardContent>
          {contracts.organizations.length === 0 ? (
            <EmptyState>{t("admin.noContracts")}</EmptyState>
          ) : (
            <ul className="divide-y rounded-md border">
              {contracts.organizations.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div>
                    <p className="font-medium">{o.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t(`admin.kinds.${o.kind}`)}
                    </p>
                  </div>
                  <ContractSwitch
                    organizationId={o.id}
                    name={o.name}
                    underContract={o.underContract}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">
            {t("admin.subscriptions")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activity.subscriptions.length === 0 ? (
            <EmptyState>{t("admin.noSubscriptions")}</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.learner")}</TableHead>
                  <TableHead>{t("admin.subject")}</TableHead>
                  <TableHead>{t("admin.payer")}</TableHead>
                  <TableHead>{t("admin.provider")}</TableHead>
                  <TableHead>{t("admin.statusLabel")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activity.subscriptions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.learnerName}</TableCell>
                    <TableCell>{s.subjectName}</TableCell>
                    <TableCell>{s.payerName ?? ""}</TableCell>
                    <TableCell>
                      {s.provider ? t(`providers.${s.provider}`) : ""}
                    </TableCell>
                    <TableCell>
                      {s.open
                        ? t(`status.${s.status}`, {
                            date: formatDate(
                              s.status === "trialing"
                                ? s.trialEndsAt
                                : s.currentPeriodEnd,
                            ),
                          })
                        : s.status === "ended"
                          ? t("status.ended")
                          : t("status.expired")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">
            {t("admin.payments")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activity.payments.length === 0 ? (
            <EmptyState>{t("admin.noPayments")}</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.date")}</TableHead>
                  <TableHead>{t("admin.learner")}</TableHead>
                  <TableHead>{t("admin.subject")}</TableHead>
                  <TableHead>{t("parent.amount")}</TableHead>
                  <TableHead>{t("admin.provider")}</TableHead>
                  <TableHead>{t("admin.kind")}</TableHead>
                  <TableHead>{t("admin.statusLabel")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activity.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.paidAt ?? p.createdAt)}</TableCell>
                    <TableCell>{p.learnerName}</TableCell>
                    <TableCell>{p.subjectName}</TableCell>
                    <TableCell>
                      {formatAmount(p.amountMinor, p.currency)}
                    </TableCell>
                    <TableCell>{t(`providers.${p.provider}`)}</TableCell>
                    <TableCell>
                      {p.kind === "renewal"
                        ? t("admin.kindRenewal")
                        : t("admin.kindInitial")}
                    </TableCell>
                    <TableCell>{t(`paymentStatus.${p.status}`)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
