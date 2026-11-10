"use client";

import { CheckCircle, CreditCard, DeviceMobile } from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/components/brand/glow-tile";
import { Button } from "@wema/ui/components/ui/button";
import { CARD_INNER_SHADOW, CardShell } from "@wema/ui/components/ui/card";
import { Spinner } from "@wema/ui/components/ui/spinner";
import { ChoiceCards } from "@wema/ui/components/wema/choice-cards";
import { cn } from "@wema/ui/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatAmount } from "../../app/parent/abonnements/format";
import { openKkiapay } from "../../app/parent/abonnements/kkiapay-widget";
import { mutate, read } from "../../lib/mutate";
import type { SessionDetail } from "./types";

type Method = "card" | "mobile_money";

/**
 * Lance le paiement d'une séance par le flux des abonnements : redirection
 * (Stripe, ou faux fournisseur en développement) ou widget Kkiapay. Le retour
 * se fait sur la page de la séance, qui fait vérifier le paiement au serveur.
 */
export async function startSessionCheckout(
  sessionId: string,
  method: Method,
  go: (href: string) => void,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const result = await mutate(
    "POST",
    `/agenda/sessions/${sessionId}/checkout`,
    {
      method,
    },
  );
  if (!result.ok) return result;
  const paymentId = read(result.data, "paymentId");
  const next = read(result.data, "next");
  const kind = read(next, "kind");
  if (typeof paymentId !== "string") return { ok: false, code: "generic" };
  if (kind === "redirect") {
    const url = read(next, "url");
    if (typeof url !== "string") return { ok: false, code: "generic" };
    window.location.assign(url);
    return { ok: true };
  }
  if (kind === "kkiapay") {
    const publicKey = read(next, "publicKey");
    const amount = read(next, "amount");
    const reference = read(next, "reference");
    if (
      typeof publicKey !== "string" ||
      typeof amount !== "number" ||
      typeof reference !== "string"
    )
      return { ok: false, code: "generic" };
    const opened = await openKkiapay({
      publicKey,
      sandbox: read(next, "sandbox") === true,
      amount,
      reference,
      onSuccess: (transactionId) =>
        go(
          `?paiement=${encodeURIComponent(paymentId)}&transaction=${encodeURIComponent(transactionId)}`,
        ),
    });
    return opened ? { ok: true } : { ok: false, code: "kkiapay_unavailable" };
  }
  return { ok: false, code: "generic" };
}

/** Choix du moyen de paiement, en cartes (masqué s'il n'y en a qu'un). */
export function MethodSelect({
  methods,
  value,
  onChange,
  columns = 2,
}: {
  methods: readonly Method[];
  value: Method | null;
  onChange: (m: Method) => void;
  columns?: 1 | 2;
}) {
  const t = useTranslations("agenda.payment");
  if (methods.length < 2) return null;
  return (
    <ChoiceCards
      aria-label={t("method")}
      size="compact"
      columns={columns}
      value={value ?? ""}
      onValueChange={(v) => {
        const m = methods.find((x) => x === v);
        if (m) onChange(m);
      }}
      options={methods.map((m) => ({
        value: m,
        title: t(`methods.${m}`),
        icon:
          m === "card" ? (
            <CreditCard weight="fill" />
          ) : (
            <DeviceMobile weight="fill" />
          ),
        tone: m === "card" ? "sky" : "amber",
      }))}
    />
  );
}

type ReturnState = "checking" | "succeeded" | "pending" | "failed" | null;

/** Bloc « Paiement de la séance » : montant, état, bouton payer, retour du fournisseur. */
export function SessionPayment({ detail }: { detail: SessionDetail }) {
  const t = useTranslations("agenda.payment");
  const tErr = useTranslations("agenda.errors");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const paymentId = params.get("paiement");
  const transactionId = params.get("transaction");
  const canceled = params.get("annule") === "1";
  const { payment, can, session, role } = detail;
  const methods = payment?.methods ?? [];
  const [method, setMethod] = useState<Method | null>(methods[0] ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ReturnState>(
    paymentId ? "checking" : null,
  );

  // Retour du fournisseur : le serveur vérifie le paiement, on réessaie un peu s'il est en attente.
  useEffect(() => {
    if (!paymentId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async (attempt: number) => {
      const result = await mutate(
        "POST",
        `/agenda/session-payments/${encodeURIComponent(paymentId)}/confirm`,
        transactionId ? { transactionId } : {},
      );
      if (stopped) return;
      if (!result.ok) {
        setError(tErr.has(result.code) ? tErr(result.code) : tErr("generic"));
        setState(null);
        return;
      }
      const status = read(result.data, "status");
      if (status === "succeeded" || status === "failed") {
        setState(status);
        router.replace(pathname);
        router.refresh();
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
  }, [paymentId, transactionId, pathname, router, tErr]);

  if (!payment) return null;
  const amount = formatAmount(payment.amountMinor, payment.currency);

  async function pay() {
    if (!method) return;
    setPending(true);
    setError(null);
    const result = await startSessionCheckout(session.id, method, (href) =>
      router.push(`${pathname}${href}`),
    );
    setPending(false);
    if (!result.ok)
      setError(tErr.has(result.code) ? tErr(result.code) : tErr("generic"));
  }

  const message = payment.paid
    ? t("paid", { amount })
    : role === "teacher"
      ? t("teacherDue")
      : t("due", { amount });

  return (
    <CardShell tone={payment.paid ? "mint" : "amber"}>
      <section
        aria-labelledby="payment-title"
        data-testid="session-payment"
        className={cn(
          "flex flex-col gap-4 rounded-card border bg-card p-4 sm:flex-row sm:items-center sm:p-5",
          CARD_INNER_SHADOW,
        )}
      >
        <GlowTile tone={payment.paid ? "mint" : "amber"} size={44}>
          {payment.paid ? (
            <CheckCircle weight="bold" />
          ) : (
            <CreditCard weight="bold" />
          )}
        </GlowTile>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id="payment-title" className="font-medium">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{message}</p>
          <p role="status" aria-live="polite" className="text-sm">
            {state === "checking" || state === "pending" ? (
              <span className="inline-flex items-center gap-2">
                <Spinner aria-hidden className="size-4" />
                {t(state)}
              </span>
            ) : state ? (
              t(state)
            ) : canceled && !payment.paid ? (
              t("canceled")
            ) : null}
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        {can.pay && (
          <div className="flex flex-col gap-2 sm:w-56">
            {methods.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noMethod")}</p>
            ) : (
              <>
                <MethodSelect
                  columns={1}
                  methods={methods}
                  value={method}
                  onChange={setMethod}
                />
                <Button
                  variant="brand"
                  disabled={pending || !method || state === "checking"}
                  onClick={pay}
                >
                  {pending ? t("paying") : t("pay")}
                </Button>
              </>
            )}
          </div>
        )}
      </section>
    </CardShell>
  );
}
