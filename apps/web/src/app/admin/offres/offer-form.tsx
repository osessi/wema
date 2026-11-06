"use client";

import { Button } from "@wema/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { AdminOffer } from "../../../lib/billing-types";
import { useBillingMutation } from "../../parent/abonnements/use-billing-mutation";
import { CheckboxField, Notice, SelectField, TextField } from "../_ui/fields";

const METHODS = ["card", "mobile_money"] as const;
type Method = (typeof METHODS)[number];

/** Création (sans `offer`) ou modification d'une offre. */
export function OfferForm({
  offer,
  countries,
  subjects,
  onDone,
}: {
  offer?: AdminOffer;
  countries: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  onDone?: () => void;
}) {
  const t = useTranslations("billing");
  const { run, pending, error } = useBillingMutation();
  const [countryId, setCountryId] = useState(
    offer?.countryId ?? countries[0]?.id ?? "",
  );
  const [subjectId, setSubjectId] = useState(
    offer?.subjectId ?? subjects[0]?.id ?? "",
  );
  const [currency, setCurrency] = useState(offer?.currency ?? "");
  const [amount, setAmount] = useState(offer ? String(offer.amountMinor) : "");
  const [intervalMonths, setIntervalMonths] = useState(
    String(offer?.intervalMonths ?? 1),
  );
  const [trialDays, setTrialDays] = useState(String(offer?.trialDays ?? 0));
  const [methods, setMethods] = useState<Method[]>(
    offer ? [...offer.methods] : [],
  );
  const [active, setActive] = useState(offer?.active ?? true);
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const fields = {
      currency,
      amountMinor: Number(amount),
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
      setSaved(true);
      if (!offer) {
        setAmount("");
        setCurrency("");
      }
      onDone?.();
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          label={t("admin.currency")}
          hint={t("admin.currencyHint")}
          required
          maxLength={3}
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        />
        <TextField
          label={t("admin.amount")}
          hint={t("admin.amountHint")}
          required
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <TextField
          label={t("admin.interval")}
          required
          type="number"
          min={1}
          max={12}
          value={intervalMonths}
          onChange={(e) => setIntervalMonths(e.target.value)}
        />
        <TextField
          label={t("admin.trialDays")}
          required
          type="number"
          min={0}
          max={90}
          value={trialDays}
          onChange={(e) => setTrialDays(e.target.value)}
        />
      </div>
      <fieldset className="flex flex-wrap gap-6">
        <legend className="mb-2 text-sm font-medium">
          {t("admin.methods")}
        </legend>
        {METHODS.map((m) => (
          <CheckboxField
            key={m}
            label={t(`methods.${m}`)}
            checked={methods.includes(m)}
            onCheckedChange={(on) =>
              setMethods((list) =>
                on ? [...list, m] : list.filter((x) => x !== m),
              )
            }
          />
        ))}
        <CheckboxField
          label={t("admin.active")}
          checked={active}
          onCheckedChange={setActive}
        />
      </fieldset>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {saved ? <Notice>{t("admin.saved")}</Notice> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {offer ? t("admin.save") : t("admin.create")}
        </Button>
      </div>
    </form>
  );
}
