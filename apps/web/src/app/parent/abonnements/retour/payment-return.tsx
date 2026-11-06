"use client";

import { Button } from "@wema/ui/components/ui/button";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { mutate, read } from "../../../../lib/mutate";

type State = "checking" | "succeeded" | "pending" | "failed" | "error";

/** Le serveur demande l'état du paiement au prestataire ; on réessaie un peu si c'est en attente. */
export function PaymentReturn({
  paymentId,
  transactionId,
}: {
  paymentId: string;
  transactionId: string | null;
}) {
  const t = useTranslations("billing");
  const [state, setState] = useState<State>("checking");
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async (attempt: number) => {
      const result = await mutate(
        "POST",
        `/parent/billing/payments/${encodeURIComponent(paymentId)}/confirm`,
        transactionId ? { transactionId } : {},
      );
      if (stopped) return;
      if (!result.ok) {
        setCode(result.code);
        setState("error");
        return;
      }
      const status = read(result.data, "status");
      if (status === "succeeded" || status === "failed") {
        setState(status);
        return;
      }
      setState("pending");
      if (attempt < 10) timer = setTimeout(() => void check(attempt + 1), 3000);
    };
    void check(0);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [paymentId, transactionId]);

  const message =
    state === "error"
      ? code && t.has(`errors.${code}`)
        ? t(`errors.${code}`)
        : t("errors.generic")
      : t(`return.${state}`);

  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <p role="status" aria-live="polite">
        {message}
      </p>
      <Button asChild variant={state === "succeeded" ? "default" : "outline"}>
        <Link href="/parent/abonnements">{t("return.back")}</Link>
      </Button>
    </div>
  );
}
