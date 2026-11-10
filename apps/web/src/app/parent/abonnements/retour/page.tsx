import { Button } from "@wema/ui/components/ui/button";
import Link from "next/link";
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
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <p>{t("missing")}</p>
          <Button asChild variant="outline">
            <Link href="/parent/abonnements">{t("back")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
