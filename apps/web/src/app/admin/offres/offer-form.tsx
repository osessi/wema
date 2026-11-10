"use client";

import { Books, CreditCard, DeviceMobile, Wallet } from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/brand";
import { Button } from "@wema/ui/components/ui/button";
import { FieldSection } from "@wema/ui/components/ui/field";
import { toast } from "@wema/ui/components/ui/sonner";
import { ChoiceCards } from "@wema/ui/components/wema/choice-cards";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
import { useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import type { AdminOffer } from "../../../lib/billing-types";
import { useBillingMutation } from "../../parent/abonnements/use-billing-mutation";
import { CheckboxField, Notice, SelectField, TextField } from "../_ui/fields";

const METHODS = ["card", "mobile_money"] as const;
type Method = (typeof METHODS)[number];
const isMethod = (v: string): v is Method => METHODS.some((m) => m === v);

/** Glyphe de chaque moyen de paiement (cartes de choix). */
export const METHOD_ICON: Record<
  Method,
  { icon: ReactNode; tone: "sky" | "mint" }
> = {
  card: { icon: <CreditCard weight="fill" />, tone: "sky" },
  mobile_money: { icon: <DeviceMobile weight="fill" />, tone: "mint" },
};

/** Au-delà, les matières restent dans une liste déroulante. */
const MAX_SUBJECT_CARDS = 6;

/**
 * Moyens de paiement en cartes à cocher. Un moyen non branché ne peut être
 * que décoché ; le nom accessible de chaque case reste le nom du moyen.
 */
export function MethodChoice({
  value,
  onChange,
  available,
  label,
}: {
  value: Method[];
  onChange: (value: Method[]) => void;
  available: readonly string[];
  label: string;
}) {
  const t = useTranslations("billing");
  const tx = useTranslations("billingAdmin");
  return (
    <ChoiceCards
      type="multiple"
      aria-label={label}
      columns={2}
      size="compact"
      value={value}
      onValueChange={(next) => onChange(next.filter(isMethod))}
      options={METHODS.map((m) => {
        const plugged = available.includes(m);
        return {
          value: m,
          title: t(`methods.${m}`),
          description: plugged
            ? tx("methodPluggedHint")
            : tx("methodNotPlugged"),
          icon: METHOD_ICON[m].icon,
          tone: plugged ? METHOD_ICON[m].tone : "slate",
          disabled: !plugged && !value.includes(m),
        };
      })}
    />
  );
}

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
  subjects: { id: string; name: string; icon?: string | null }[];
  /** Moyens de paiement branchés sur ce serveur. */
  available: readonly string[];
  onDone?: () => void;
}) {
  const t = useTranslations("billing");
  const tx = useTranslations("billingAdmin");
  const { run, pending, error } = useBillingMutation();
  const subjectLabelId = useId();
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
    <form className="flex flex-col gap-4" onSubmit={submit}>
      {offer ? null : (
        <FieldSection
          title={tx("sectionScope")}
          description={tx("sectionScopeHint")}
          icon={
            <GlowTile tone="sky" size={32}>
              <Books weight="fill" />
            </GlowTile>
          }
        >
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
          {subjects.length <= MAX_SUBJECT_CARDS ? (
            <div className="grid gap-2">
              <p className="text-sm font-medium" id={subjectLabelId}>
                {t("admin.subject")}
              </p>
              <ChoiceCards
                aria-labelledby={subjectLabelId}
                columns={2}
                size="compact"
                value={subjectId}
                onValueChange={setSubjectId}
                options={subjects.map((s) => ({
                  value: s.id,
                  title: s.name,
                  media: <SubjectIcon icon={s.icon} size={32} />,
                }))}
              />
            </div>
          ) : (
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
          )}
        </FieldSection>
      )}
      <FieldSection
        title={tx("sectionPrice")}
        description={tx("sectionPriceHint")}
        tone="brand"
        icon={
          <GlowTile tone="yellow" size={32}>
            <Wallet weight="fill" />
          </GlowTile>
        }
      >
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
      </FieldSection>
      <FieldSection
        title={tx("sectionPayment")}
        description={tx("sectionPaymentHint")}
        icon={
          <GlowTile tone="mint" size={32}>
            <CreditCard weight="fill" />
          </GlowTile>
        }
      >
        <MethodChoice
          label={t("admin.methods")}
          value={methods}
          onChange={setMethods}
          available={available}
        />
        <CheckboxField
          label={t("admin.active")}
          hint={tx("activeHint")}
          checked={active}
          onCheckedChange={setActive}
        />
      </FieldSection>
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
