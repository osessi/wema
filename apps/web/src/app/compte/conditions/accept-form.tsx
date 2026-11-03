"use client";

import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { Checkbox } from "@wema/ui/components/ui/checkbox";
import { Label } from "@wema/ui/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { mutate } from "../../../lib/mutate";
import { useMutation } from "../../../lib/use-mutation";

export function AcceptForm({
  termsVersion,
  privacyVersion,
}: {
  termsVersion: string;
  privacyVersion: string;
}) {
  const t = useTranslations("legal.accept");
  const id = useId();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const { run, pending, error } = useMutation();

  async function accept() {
    const result = await run(
      "POST",
      "/account/terms",
      { termsVersion, privacyVersion },
      { refresh: false },
    );
    if (result.ok) {
      router.push("/");
      router.refresh();
    }
  }

  async function logout() {
    await mutate("POST", "/auth/logout");
    router.push("/connexion");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="space-y-2 text-sm">
        <li>
          <Link
            href="/conditions"
            target="_blank"
            className="font-medium underline underline-offset-4"
          >
            {t("terms", { version: termsVersion })}
          </Link>
        </li>
        <li>
          <Link
            href="/confidentialite"
            target="_blank"
            className="font-medium underline underline-offset-4"
          >
            {t("privacy", { version: privacyVersion })}
          </Link>
        </li>
      </ul>
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => setChecked(v === true)}
        />
        <Label htmlFor={id} className="font-normal leading-snug">
          {t("checkbox")}
        </Label>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button disabled={!checked || pending} onClick={accept}>
        {t("submit")}
      </Button>
      <Button variant="ghost" onClick={logout}>
        {t("logout")}
      </Button>
    </div>
  );
}
