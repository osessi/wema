"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { type MutationResult, mutate } from "../../../lib/mutate";

/** Écriture liée au paiement : erreurs traduites par « billing.errors ». */
export function useBillingMutation() {
  const t = useTranslations("billing.errors");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(
    method: "POST" | "PATCH" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
    options: { refresh?: boolean } = {},
  ): Promise<MutationResult> {
    setPending(true);
    setError(null);
    const result = await mutate(method, path, body);
    setPending(false);
    if (!result.ok) {
      if (result.code === "unauthenticated") router.push("/connexion");
      setError(t.has(result.code) ? t(result.code) : t("generic"));
    } else if (options.refresh !== false) {
      router.refresh();
    }
    return result;
  }

  return { run, pending, error, setError };
}
