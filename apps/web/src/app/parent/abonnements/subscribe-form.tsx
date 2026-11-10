"use client";

import { PlusCircle } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { Label } from "@wema/ui/components/ui/label";
import { NativeSelect } from "@wema/ui/components/ui/native-select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { BillingChild, BillingOffer } from "../../../lib/billing-types";
import { read } from "../../../lib/mutate";
import { formatAmount } from "./format";
import { openKkiapay } from "./kkiapay-widget";
import { useBillingMutation } from "./use-billing-mutation";

/** Choisir une matière pour un enfant, puis l'essayer ou la payer. */
export function SubscribeForm({
  child,
  offers: allOffers,
}: {
  child: BillingChild;
  offers: BillingOffer[];
}) {
  const t = useTranslations("billing");
  const router = useRouter();
  const countryFieldId = useId();
  const subjectFieldId = useId();
  const { run, pending, error, setError } = useBillingMutation();
  const [redirecting, setRedirecting] = useState(false);

  // L'offre suit le pays du programme de l'enfant (classe ou programme
  // individuel) : l'API dit lesquelles conviennent, jamais un pays au hasard.
  const offers = allOffers.filter((o) => child.offerIds.includes(o.id));
  const countries = [
    ...new Map(offers.map((o) => [o.countryId, o.countryName])).entries(),
  ];
  const initialCountry = countries[0]?.[0] ?? "";
  const [countryId, setCountryId] = useState(initialCountry);
  const inCountry = offers.filter((o) => o.countryId === countryId);
  const [offerId, setOfferId] = useState(inCountry[0]?.id ?? "");
  const offer = inCountry.find((o) => o.id === offerId) ?? inCountry[0];

  if (child.countryIds.length === 0)
    return (
      <div className="flex flex-col items-start gap-3 rounded-card border border-dashed p-4">
        <p className="text-sm text-muted-foreground">{t("parent.noProgram")}</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/parent/famille">{t("parent.chooseProgram")}</Link>
        </Button>
      </div>
    );
  if (offers.length === 0)
    return (
      <p className="text-sm text-muted-foreground">{t("parent.noOffer")}</p>
    );

  const live = offer
    ? child.subscriptions.find((s) => s.subjectId === offer.subjectId)
    : undefined;
  const trialAvailable =
    offer !== undefined &&
    offer.trialDays > 0 &&
    !child.usedTrialSubjectIds.includes(offer.subjectId);
  // Un abonnement récurrent par carte en cours se renouvelle seul.
  const recurring = live?.open && live.provider === "stripe";

  async function pay(method: "card" | "mobile_money") {
    if (!offer) return;
    const result = await run(
      "POST",
      "/parent/billing/checkout",
      { learnerId: child.learnerId, offerId: offer.id, method },
      { refresh: false },
    );
    if (!result.ok) return;
    const paymentId = read(result.data, "paymentId");
    const next = read(result.data, "next");
    const kind = read(next, "kind");
    if (kind === "redirect") {
      const url = read(next, "url");
      if (typeof url === "string") {
        setRedirecting(true);
        window.location.assign(url);
      }
      return;
    }
    if (kind === "kkiapay" && typeof paymentId === "string") {
      const publicKey = read(next, "publicKey");
      const amount = read(next, "amount");
      const opened =
        typeof publicKey === "string" &&
        typeof amount === "number" &&
        (await openKkiapay({
          publicKey,
          amount,
          sandbox: read(next, "sandbox") === true,
          reference: paymentId,
          onSuccess: (transactionId) =>
            router.push(
              `/parent/abonnements/retour?paiement=${paymentId}&transaction=${encodeURIComponent(transactionId)}`,
            ),
        }));
      if (!opened) setError(t("errors.widget"));
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-card border bg-background/60 p-4">
      <h3 className="flex items-center gap-2 font-medium">
        <PlusCircle aria-hidden weight="bold" className="size-4" />
        {t("parent.add")}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {countries.length > 1 ? (
          <div className="grid gap-2">
            <Label htmlFor={countryFieldId}>{t("parent.country")}</Label>
            <NativeSelect
              id={countryFieldId}
              value={countryId}
              onChange={(e) => {
                setCountryId(e.target.value);
                setOfferId(
                  offers.find((o) => o.countryId === e.target.value)?.id ?? "",
                );
              }}
            >
              {countries.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor={subjectFieldId}>{t("parent.subject")}</Label>
          <NativeSelect
            id={subjectFieldId}
            value={offer?.id ?? ""}
            onChange={(e) => setOfferId(e.target.value)}
          >
            {inCountry.map((o) => (
              <option key={o.id} value={o.id}>
                {o.subjectName}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {offer ? (
        <div className="flex flex-col gap-3">
          <p className="text-2xl font-light tracking-tight tabular-nums">
            {offer.intervalMonths === 1
              ? t("price.month", {
                  amount: formatAmount(offer.amountMinor, offer.currency),
                })
              : t("price.months", {
                  amount: formatAmount(offer.amountMinor, offer.currency),
                  months: offer.intervalMonths,
                })}
          </p>
          {recurring ? null : (
            <div className="flex flex-wrap gap-2">
              {offer.methods.map((m, i) => (
                <Button
                  key={m}
                  className="h-auto min-h-9 max-w-full shrink whitespace-normal text-left"
                  variant={i === 0 ? "brand" : "outline"}
                  disabled={pending || redirecting}
                  onClick={() => void pay(m)}
                >
                  {live?.open ? t("parent.renew") : t("parent.pay")} ·{" "}
                  {t(`methods.${m}`)}
                </Button>
              ))}
              {trialAvailable && !live ? (
                <Button
                  variant="outline"
                  disabled={pending || redirecting}
                  onClick={() =>
                    void run("POST", "/parent/billing/trial", {
                      learnerId: child.learnerId,
                      offerId: offer.id,
                    })
                  }
                >
                  {t("parent.trial", { days: offer.trialDays })}
                </Button>
              ) : null}
            </div>
          )}
          {offer.methods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("parent.noMethod")}
            </p>
          ) : null}
          {offer.trialDays > 0 && !trialAvailable && !live ? (
            <p className="text-sm text-muted-foreground">
              {t("parent.trialUsed")}
            </p>
          ) : null}
          {redirecting ? (
            <p className="text-sm text-muted-foreground">
              {t("parent.redirecting")}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("parent.noOffer")}</p>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
