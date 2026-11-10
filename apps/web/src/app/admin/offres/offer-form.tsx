"use client";

import { Button } from "@wema/ui/components/ui/button";
import { toast } from "@wema/ui/components/ui/sonner";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { AdminOffer } from "../../../lib/billing-types";
import { useBillingMutation } from "../../parent/abonnements/use-billing-mutation";
import { CheckboxField, Notice, SelectField, TextField } from "../_ui/fields";

const METHODS = ["card", "mobile_money"] as const;
type Method = (typeof METHODS)[number];

/** Nombre de décimales de la devise (Intl), ou `null` si la devise est inconnue. */
export function currencyDigits(currency: string): number | null {
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  try {
    return (
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return null;
  }
}

/** Création (sans `offer`) ou modification d'une offre. */
export function OfferForm({
  offer,
  countries,
  subjects,
  available,
  onDone,
}: {
  offer?: AdminOffer;
  countries: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  /** Moyens de paiement branchés sur ce serveur. */
  available: readonly string[];
  onDone?: () => void;
}) {
  const t = useTranslations("billing");
  const tx = useTranslations("billingAdmin");
  const { run, pending, error } = useBillingMutation();
  const [countryId, setCountryId] = useState(
    offer?.countryId ?? countries[0]?.id ?? "",
  );
  const [subjectId, setSubjectId] = useState(
    offer?.subjectId ?? subjects[0]?.id ?? "",
  );
  const [currency, setCurrency] = useState(offer?.currency ?? "");
  // Prix saisi en unités normales (29,90) ; envoyé en plus petite unité.
  const [amount, setAmount] = useState(() => {
    if (!offer) return "";
    const digits = currencyDigits(offer.currency) ?? 2;
    return String(offer.amountMinor / 10 ** digits);
  });
  const [intervalMonths, setIntervalMonths] = useState(
    String(offer?.intervalMonths ?? 1),
  );
  const [trialDays, setTrialDays] = useState(String(offer?.trialDays ?? 0));
  const [methods, setMethods] = useState<Method[]>(
    offer ? [...offer.methods] : [],
  );
  const [active, setActive] = useState(offer?.active ?? true);

  const digits = currencyDigits(currency);
  const value = Number(amount.replace(",", "."));
  const amountMinor =
    digits === null || !Number.isFinite(value)
      ? null
      : Math.round(value * 10 ** digits);
  const preview =
    digits !== null && amountMinor !== null && amountMinor > 0
      ? tx(Number(intervalMonths) > 1 ? "previewMonths" : "previewMonth", {
          amount: new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency,
          }).format(amountMinor / 10 ** digits),
          months: Number(intervalMonths) || 1,
        })
      : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (amountMinor === null) return;
    const fields = {
      currency,
      amountMinor,
      intervalMonths: Number(intervalMonths),
      trialDays: Number(trialDays),
      methods,
      active,
    };
    const result = offer
      ? await run("PATCH", `/admin/billing/offers/${offer.id}`, fields)
      : await run("POST", "/admin/billing/offers", {
          ...fields,
          countryId,
          subjectId,
        });
    if (result.ok) {
      toast.success(t("admin.saved"));
      if (!offer) {
        setAmount("");
        setCurrency("");
      }
      onDone?.();
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      {offer ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={t("admin.country")}
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
          >
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t("admin.subject")}
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
        </div>
      )}
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <TextField
          label={t("admin.currency")}
          hint={t("admin.currencyHint")}
          required
          maxLength={3}
          className="[&_input]:font-mono [&_input]:uppercase"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        />
        <TextField
          label={t("admin.amount")}
          hint={preview ?? tx("amountHint")}
          error={
            currency.length === 3 && digits === null
              ? tx("unknownCurrency")
              : undefined
          }
          required
          inputMode="decimal"
          type="number"
          min={0}
          step="any"
          placeholder={tx("amountPlaceholder")}
          className="[&_input]:tabular-nums"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <TextField
          label={t("admin.interval")}
          required
          type="number"
          min={1}
          max={12}
          className="[&_input]:tabular-nums"
          value={intervalMonths}
          onChange={(e) => setIntervalMonths(e.target.value)}
        />
        <TextField
          label={t("admin.trialDays")}
          required
          type="number"
          min={0}
          max={90}
          className="[&_input]:tabular-nums"
          value={trialDays}
          onChange={(e) => setTrialDays(e.target.value)}
        />
      </div>
      <fieldset className="grid gap-3">
        <legend className="mb-3 text-sm font-medium">
          {t("admin.methods")}
        </legend>
        {METHODS.map((m) => {
          const plugged = available.includes(m);
          const checked = methods.includes(m);
          return (
            <CheckboxField
              key={m}
              label={t(`methods.${m}`)}
              hint={plugged ? undefined : tx("methodNotPlugged")}
              checked={checked}
              // Non branché : on peut seulement le décocher.
              disabled={!plugged && !checked}
              onCheckedChange={(on) =>
                setMethods((list) =>
                  on ? [...list, m] : list.filter((x) => x !== m),
                )
              }
            />
          );
        })}
      </fieldset>
      <CheckboxField
        label={t("admin.active")}
        hint={tx("activeHint")}
        checked={active}
        onCheckedChange={setActive}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="brand"
          disabled={pending || amountMinor === null || amountMinor <= 0}
        >
          {offer ? t("admin.save") : t("admin.create")}
        </Button>
      </div>
    </form>
  );
}
