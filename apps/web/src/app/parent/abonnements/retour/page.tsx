import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../components/page-header";
import { PaymentReturn } from "./payment-return";

/** Retour du parent après le paiement (Stripe, Kkiapay ou simulation). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ paiement?: string; transaction?: string }>;
}) {
  const t = await getTranslations("billing.return");
  const { paiement, transaction } = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />
      {paiement ? (
        <PaymentReturn
          paymentId={paiement}
          transactionId={transaction ?? null}
        />
      ) : (
        <p className="rounded-lg border bg-card p-6">{t("missing")}</p>
      )}
    </div>
  );
}
