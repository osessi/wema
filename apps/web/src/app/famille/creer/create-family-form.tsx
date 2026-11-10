"use client";

import { UsersThree } from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/components/brand/glow-tile";
import { Button } from "@wema/ui/components/ui/button";
import { FieldSection } from "@wema/ui/components/ui/field";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useMutation } from "../../../lib/use-mutation";
import { Notice, TextField } from "../../admin/_ui/fields";

export function CreateFamilyForm({
  defaultName,
  next = "/parent/famille",
}: {
  defaultName: string;
  /** Page suivante une fois la famille créée. */
  next?: string;
}) {
  const t = useTranslations("family.create");
  const router = useRouter();
  const { run, pending, error } = useMutation();
  const [name, setName] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const result = await run(
      "POST",
      "/family",
      trimmed ? { name: trimmed } : {},
      { refresh: false },
    );
    if (result.ok) {
      router.push(next);
      router.refresh();
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <FieldSection
        tone="sky"
        title={t("title")}
        description={t("description")}
        icon={
          <GlowTile tone="sky" size={36}>
            <UsersThree weight="fill" />
          </GlowTile>
        }
      >
        <TextField
          label={t("name")}
          maxLength={200}
          placeholder={t("namePlaceholder", { name: defaultName })}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </FieldSection>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button
        type="submit"
        variant="brand"
        className="w-full sm:w-auto sm:self-end"
        disabled={pending}
      >
        {t("submit")}
      </Button>
    </form>
  );
}
