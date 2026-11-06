"use client";

import { Button } from "@wema/ui/components/ui/button";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useMutation } from "../../../lib/use-mutation";
import { Notice, TextField } from "../../admin/_ui/fields";

export function CreateFamilyForm({ defaultName }: { defaultName: string }) {
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
      router.push("/parent/famille");
      router.refresh();
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <TextField
        label={t("name")}
        maxLength={200}
        placeholder={t("namePlaceholder", { name: defaultName })}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
