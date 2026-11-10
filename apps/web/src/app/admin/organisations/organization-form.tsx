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
import { ChoiceCards } from "@wema/ui/components/wema/choice-cards";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { read } from "../../../lib/mutate";
import { useMutation } from "../../../lib/use-mutation";
import { Notice, TextField } from "../_ui/fields";
import { KIND_LOOK } from "./kinds";

const KINDS = ["school", "tutoring", "family"] as const;
type Kind = (typeof KINDS)[number];
const isKind = (value: string): value is Kind => KINDS.some((k) => k === value);

export function OrganizationForm() {
  const t = useTranslations();
  const router = useRouter();
  const { run, pending, error } = useMutation();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("school");
  const kindId = useId();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await run("POST", "/admin/organizations", {
      name,
      kind,
      // Rôles par défaut du type (fiche 0010), modifiables ensuite.
      defaultRoles: true,
    });
    const id = result.ok ? read(result.data, "id") : null;
    if (typeof id === "string") router.push(`/admin/organisations/${id}`);
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <TextField
        label={t("common.name")}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex flex-col gap-2">
        <p id={kindId} className="text-sm font-medium">
          {t("organizations.kind")}
        </p>
        <ChoiceCards
          aria-labelledby={kindId}
          name="kind"
          columns={3}
          size="compact"
          value={kind}
          onValueChange={(v) => {
            if (isKind(v)) setKind(v);
          }}
          options={KINDS.map((k) => {
            const look = KIND_LOOK[k];
            return {
              value: k,
              title: t(`organizations.kinds.${k}`),
              icon: <look.Icon weight="fill" />,
              tone: look.tone,
            };
          })}
        />
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex justify-end">
        <Button type="submit" variant="brand" disabled={pending}>
          {t("common.create")}
        </Button>
      </div>
    </form>
  );
}

/** Bouton « Nouvelle organisation » et son dialogue de création. */
export function NewOrganizationDialog() {
  const t = useTranslations("organizations");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden weight="bold" />
          {t("new")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("new")}</DialogTitle>
          <DialogDescription>{t("newHint")}</DialogDescription>
        </DialogHeader>
        <OrganizationForm />
      </DialogContent>
    </Dialog>
  );
}
