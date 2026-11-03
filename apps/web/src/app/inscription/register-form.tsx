"use client";

import { Button } from "@wema/ui/components/ui/button";
import { Checkbox } from "@wema/ui/components/ui/checkbox";
import { Label } from "@wema/ui/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { useMutation } from "../../lib/use-mutation";
import { Notice, TextField } from "../admin/_ui/fields";

export function RegisterForm() {
  const t = useTranslations("auth");
  const tLegal = useTranslations("legal.register");
  const acceptId = useId();
  const [birthYear, setBirthYear] = useState("");
  const [accepted, setAccepted] = useState(false);
  const router = useRouter();
  const { run, pending, error } = useMutation();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    // Année déclarée : vérifie l'âge du consentement numérique (non conservée).
    const result = await run(
      "POST",
      "/auth/register",
      { ...form, birthYear: Number(birthYear), acceptTerms: true },
      { refresh: false },
    );
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
      <TextField
        label={tLegal("birthYear")}
        hint={tLegal("birthYearHint")}
        type="number"
        inputMode="numeric"
        required
        min={1900}
        max={new Date().getFullYear()}
        value={birthYear}
        onChange={(e) => setBirthYear(e.target.value)}
      />
      <div className="flex items-start gap-3">
        <Checkbox
          id={acceptId}
          checked={accepted}
          onCheckedChange={(v) => setAccepted(v === true)}
        />
        <Label htmlFor={acceptId} className="font-normal leading-snug">
          <span>
            {tLegal.rich("accept", {
              terms: (chunks) => (
                <Link
                  href="/conditions"
                  target="_blank"
                  className="underline underline-offset-4"
                >
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link
                  href="/confidentialite"
                  target="_blank"
                  className="underline underline-offset-4"
                >
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </Label>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button
        type="submit"
        className="w-full"
        disabled={pending || !accepted || birthYear === ""}
      >
        {t("register")}
      </Button>
    </form>
  );
}
