"use client";

import { CalendarPlus } from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/brand";
import { Button } from "@wema/ui/components/ui/button";
import { FieldSection } from "@wema/ui/components/ui/field";
import { toast } from "@wema/ui/components/ui/sonner";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { formatAmount } from "../../parent/abonnements/format";
import { useBillingMutation } from "../../parent/abonnements/use-billing-mutation";
import { Notice, SelectField, TextField } from "../_ui/fields";
import { currencyDigits, METHOD_ICON, MethodChoice } from "./offer-form";

const METHODS = ["card", "mobile_money"] as const;
type Method = (typeof METHODS)[number];

interface Price {
  countryId: string;
  countryName: string;
  currency: string;
  amountMinor: number;
  methods: Method[];
}

/**
 * Prix d'une séance par pays : saisi par l'équipe Wema, aucun par défaut.
 * Choisir un pays qui a déjà un prix le remplace.
 */
export function SessionPrices({
  prices,
  countries,
  available,
}: {
  prices: Price[];
  countries: { id: string; name: string }[];
  available: readonly string[];
}) {
  const t = useTranslations("sessionPrices");
  const tb = useTranslations("billing");
  const tx = useTranslations("billingAdmin");
  const { run, pending, error } = useBillingMutation();
  const [countryId, setCountryId] = useState(countries[0]?.id ?? "");
  const [currency, setCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [methods, setMethods] = useState<Method[]>([]);

  const digits = currencyDigits(currency);
  const value = Number(amount.replace(",", "."));
  const amountMinor =
    digits === null || !Number.isFinite(value) || amount.trim() === ""
      ? null
      : Math.round(value * 10 ** digits);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (amountMinor === null || amountMinor <= 0) return;
    const result = await run(
      "PUT",
      `/admin/billing/session-prices/${countryId}`,
      { currency, amountMinor, methods },
    );
    if (result.ok) {
      toast.success(t("saved"));
      setAmount("");
    }
  }

  return (
    <FieldSection
      title={t("title")}
      description={t("hint")}
      tone="brand"
      icon={
        <GlowTile tone="yellow" size={36}>
          <CalendarPlus weight="fill" />
        </GlowTile>
      }
    >
      {prices.length === 0 ? (
        <p className="rounded-card border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {t("none")}
        </p>
      ) : (
        <ul
          className="divide-y rounded-card border bg-muted/30"
          aria-label={t("title")}
        >
          {prices.map((p) => (
            <li
              key={p.countryId}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {p.countryName}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {p.methods.length > 0
                    ? p.methods.map((m) => (
                        <span
                          key={m}
                          className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 [&_svg]:size-3.5"
                        >
                          {METHOD_ICON[m].icon}
                          {tb(`methods.${m}`)}
                        </span>
                      ))
                    : t("noMethodWarning")}
                </span>
              </span>
              <span className="font-medium tabular-nums">
                {formatAmount(p.amountMinor, p.currency)}
              </span>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm">
                    {t("remove")}
                  </Button>
                }
                title={t("removeTitle")}
                description={t("removeText", { country: p.countryName })}
                variant="destructive"
                onConfirm={async () => {
                  const result = await run(
                    "DELETE",
                    `/admin/billing/session-prices/${p.countryId}`,
                  );
                  if (result.ok) toast.success(t("removed"));
                  return result.ok;
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-4 rounded-card border border-dashed p-3 sm:p-4"
        onSubmit={submit}
        aria-label={tx("newPrice")}
      >
        <div>
          <p className="text-sm font-semibold">{tx("newPrice")}</p>
          <p className="text-xs text-muted-foreground">{tx("newPriceHint")}</p>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-3">
          <SelectField
            label={t("country")}
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
          >
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label={tb("admin.currency")}
            hint={tb("admin.currencyHint")}
            required
            maxLength={3}
            className="[&_input]:font-mono [&_input]:uppercase"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          />
          <TextField
            label={t("price")}
            hint={tx("amountHint")}
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
            className="[&_input]:tabular-nums"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <p className="text-sm font-medium">{t("methods")}</p>
          <MethodChoice
            label={t("methods")}
            value={methods}
            onChange={setMethods}
            available={available}
          />
        </div>
        {methods.length === 0 && amount !== "" ? (
          <Notice tone="warning">{t("noMethodWarning")}</Notice>
        ) : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="outline"
            disabled={
              pending || !countryId || amountMinor === null || amountMinor <= 0
            }
          >
            {t("set")}
          </Button>
        </div>
      </form>
    </FieldSection>
  );
}
