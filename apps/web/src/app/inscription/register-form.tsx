"use client";

import { Button } from "@wema/ui/components/ui/button";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useMutation } from "../../lib/use-mutation";
import { Notice, TextField } from "../admin/_ui/fields";

export function RegisterForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { run, pending, error } = useMutation();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await run("POST", "/auth/register", form, {
      refresh: false,
    });
    if (result.ok) {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <TextField
        label={t("registerName")}
        autoComplete="name"
        required
        maxLength={120}
        value={form.displayName}
        onChange={(e) => setForm({ ...form, displayName: e.target.value })}
      />
      <TextField
        label={t("email")}
        type="email"
        autoComplete="email"
        required
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <TextField
        label={t("newPassword")}
        hint={t("newPasswordHint")}
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {t("register")}
      </Button>
    </form>
  );
}
