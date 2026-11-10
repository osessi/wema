"use client";

import { Plus } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@wema/ui/components/ui/dialog";
import { toast } from "@wema/ui/components/ui/sonner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { read } from "../../../lib/mutate";
import { useMutation } from "../../../lib/use-mutation";
import { CheckboxField, Notice, TextField } from "../_ui/fields";

interface CountryValues {
  id: string;
  code: string;
  name: string;
  unitLabel: { singular: string; plural: string };
  archived: boolean;
}

/** Création d'un pays, ou réglages d'un pays existant. */
export function CountryForm({ country }: { country?: CountryValues }) {
  const t = useTranslations();
  const router = useRouter();
  const { run, pending, error } = useMutation();
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState({
    code: country?.code ?? "",
    name: country?.name ?? "",
    singular: country?.unitLabel.singular ?? "",
    plural: country?.unitLabel.plural ?? "",
    archived: country?.archived ?? false,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const unitLabel = { singular: values.singular, plural: values.plural };
    if (country) {
      const result = await run(
        "PATCH",
        `/admin/curriculum/countries/${country.id}`,
        {
          name: values.name,
          unitLabel,
          archived: values.archived,
        },
      );
      setSaved(result.ok);
      if (result.ok) toast.success(t("common.saved"));
    } else {
      const result = await run("POST", "/admin/curriculum/countries", {
        code: values.code,
        name: values.name,
        unitLabel,
      });
      const id = result.ok ? read(result.data, "id") : null;
      if (typeof id === "string") router.push(`/admin/referentiel/${id}`);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
        {country ? null : (
          <TextField
            label={t("curriculum.countryCode")}
            hint={t("curriculum.countryCodeHint")}
            required
            maxLength={3}
            value={values.code}
            onChange={(e) => setValues({ ...values, code: e.target.value })}
          />
        )}
        <TextField
          label={t("curriculum.countryName")}
          required
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
        />
        <TextField
          label={t("curriculum.unitSingular")}
          hint={t("curriculum.unitSingularHint")}
          required
          value={values.singular}
          onChange={(e) => setValues({ ...values, singular: e.target.value })}
        />
        <TextField
          label={t("curriculum.unitPlural")}
          required
          value={values.plural}
          onChange={(e) => setValues({ ...values, plural: e.target.value })}
        />
      </div>
      {country ? (
        <CheckboxField
          label={t("common.archived")}
          checked={values.archived}
          onCheckedChange={(archived) => setValues({ ...values, archived })}
        />
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {saved ? <Notice tone="success">{t("common.saved")}</Notice> : null}
      <div className="flex justify-end">
        <Button
          type="submit"
          variant={country ? "default" : "brand"}
          disabled={pending}
        >
          {country ? t("common.save") : t("common.create")}
        </Button>
      </div>
    </form>
  );
}

/** Bouton « Nouveau pays » et son dialogue de création. */
export function NewCountryDialog() {
  const t = useTranslations("curriculum");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden weight="bold" />
          {t("newCountry")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("newCountry")}</DialogTitle>
          <DialogDescription>{t("newCountryHint")}</DialogDescription>
        </DialogHeader>
        <CountryForm />
      </DialogContent>
    </Dialog>
  );
}
