"use client";

import { Alert, Button, SelectField, TextField } from "@wema/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { read } from "../../../lib/mutate";
import { useMutation } from "../../../lib/use-mutation";

const KINDS = ["school", "tutoring", "family"] as const;
type Kind = (typeof KINDS)[number];
const isKind = (value: string): value is Kind => KINDS.some((k) => k === value);

export function OrganizationForm() {
  const t = useTranslations();
  const router = useRouter();
  const { run, pending, error } = useMutation();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("school");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await run("POST", "/admin/organizations", { name, kind });
    const id = result.ok ? read(result.data, "id") : null;
    if (typeof id === "string") router.push(`/admin/organisations/${id}`);
  }

  return (
    <form className="w-stack" onSubmit={submit}>
      <div className="w-grid w-grid--narrow">
        <TextField
          label={t("common.name")}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <SelectField
          label={t("organizations.kind")}
          value={kind}
          onChange={(e) => {
            if (isKind(e.target.value)) setKind(e.target.value);
          }}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`organizations.kinds.${k}`)}
            </option>
          ))}
        </SelectField>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {t("common.create")}
        </Button>
      </div>
    </form>
  );
}
