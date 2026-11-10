import { Question } from "@phosphor-icons/react/ssr";
import { Button } from "@wema/ui/components/ui/button";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
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
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} />
      {paiement ? (
        <PaymentReturn
          paymentId={paiement}
          transactionId={transaction ?? null}
        />
      ) : (
        <EmptyState
          icon={<Question weight="bold" />}
          titleAs="h2"
          title={t("missing")}
          action={
            <Button asChild variant="outline">
              <Link href="/parent/abonnements">{t("back")}</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
