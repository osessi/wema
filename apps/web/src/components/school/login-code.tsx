"use client";

import { Key } from "@phosphor-icons/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@wema/ui/components/ui/alert";
import { useTranslations } from "next-intl";

/** Code de connexion d'un compte élève : montré une seule fois, à noter. */
export function LoginCode({
  name,
  username,
  code,
}: {
  name: string;
  username?: string | undefined;
  code: string;
}) {
  const t = useTranslations("school.loginCode");
  return (
    <Alert className="border-brand bg-brand-soft">
      <Key aria-hidden />
      <AlertTitle>{t("title", { name })}</AlertTitle>
      <AlertDescription className="space-y-1">
        {username && (
          <p>
            {t("username")}{" "}
            <strong className="font-mono text-foreground">{username}</strong>
          </p>
        )}
        <p>
          {t("code")}{" "}
          <strong className="font-mono text-lg tracking-widest text-foreground">
            {code}
          </strong>
        </p>
        <p>{t("once")}</p>
      </AlertDescription>
    </Alert>
  );
}
