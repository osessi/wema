"use client";

import { XCircle } from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/components/brand/glow-tile";
import { Button } from "@wema/ui/components/ui/button";
import { Spinner } from "@wema/ui/components/ui/spinner";
import { SuccessBurst } from "@wema/ui/components/wema/success-burst";
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

  const back = (
    <Button asChild variant={state === "succeeded" ? "brand" : "outline"}>
      <Link href="/parent/abonnements">{t("return.back")}</Link>
    </Button>
  );

  if (state === "succeeded")
    return (
      <div className="flex justify-center rounded-card border bg-card px-4 py-10 shadow-xs">
        <SuccessBurst title={message} action={back} />
      </div>
    );

  const waiting = state === "checking" || state === "pending";
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border bg-card px-4 py-10 text-center shadow-xs">
      {waiting ? (
        <Spinner
          role="presentation"
          aria-hidden
          className="size-10 text-brand"
        />
      ) : (
        <GlowTile tone="rose" size={56}>
          <XCircle weight="bold" />
        </GlowTile>
      )}
      <p role="status" aria-live="polite" className="max-w-md text-balance">
        {message}
      </p>
      {back}
    </div>
  );
}
