"use client";

import { Key } from "@phosphor-icons/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { read } from "../../lib/mutate";
import { useMutation } from "../../lib/use-mutation";

/** Compte parent d'un élève : e-mail facultatif, code montré une seule fois. */
export function GuardianForm({
  organizationId,
  learnerId,
  learnerName,
}: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
}) {
  const t = useTranslations("tutoring.onboarding.parents");
  const id = useId();
  const { run, pending, error } = useMutation();
  const [email, setEmail] = useState("");
  const [shown, setShown] = useState<{ login: string; code: string } | null>(
    null,
  );
  // Compte non créé (message générique) ou parent existant rattaché.
  const [notice, setNotice] = useState<"linked" | "not_created" | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await run(
      "POST",
      `/admin/organizations/${organizationId}/learners/${learnerId}/guardian`,
      { email: email.trim() || null },
    );
    if (!result.ok) return;
    const parentNotice = read(result.data, "parentNotice");
    if (parentNotice === "linked" || parentNotice === "not_created") {
      setNotice(parentNotice);
      return;
    }
    const login = read(result.data, "login");
    const code = read(result.data, "code");
    if (typeof login === "string" && typeof code === "string")
      setShown({ login, code });
  }

  if (notice)
    return (
      <Alert variant={notice === "linked" ? "success" : "warning"}>
        <AlertDescription>{t(`notice.${notice}`)}</AlertDescription>
      </Alert>
    );

  if (shown)
    return (
      <Alert className="border-brand bg-brand-soft">
        <Key aria-hidden />
        <AlertTitle>{t("codeTitle", { name: learnerName })}</AlertTitle>
        <AlertDescription className="space-y-1">
          <p>
            {t("login")}{" "}
            <strong className="font-mono break-all text-foreground">
              {shown.login}
            </strong>
          </p>
          <p>
            {t("code")}{" "}
            <strong className="font-mono text-lg tracking-widest text-foreground">
              {shown.code}
            </strong>
          </p>
          <p>{t("once")}</p>
        </AlertDescription>
      </Alert>
    );

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label htmlFor={`${id}-email`} className="text-xs">
          {t("email")}
        </Label>
        <Input
          id={`${id}-email`}
          type="email"
          autoComplete="off"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {t("create")}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger-text sm:basis-full">
          {error}
        </p>
      ) : null}
    </form>
  );
}
