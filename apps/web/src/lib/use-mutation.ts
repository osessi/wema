"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { type MutationResult, mutate } from "./mutate";

const KNOWN_ERRORS = new Set([
  // RGPD (fiche 0008).
  "minor_needs_guardian",
  "guardian_required",
  "children_first",
  "terms_outdated",
  "network",
  "unauthenticated",
  "forbidden",
  "not_found",
  "invalid_credentials",
  "invalid_email",
  "invalid_phone",
  "invalid_username",
  "password_too_short",
  "password_too_long",
  "email_taken",
  "username_taken",
  "identifier_taken",
  "code_mismatch",
  "code_expired",
  "code_used",
  "too_many_attempts",
  "server_busy",
  "service_unavailable",
  "slow_down",
  "too_many_codes",
  "send_failed",
  "duplicate",
  "invalid_reference",
  "invalid_prerequisites",
  "invalid_settings",
  "invalid_routing",
  "duplicate_role_name",
  "system_role",
  "role_in_use",
  "role_not_found",
  "last_super_admin",
  "bad_origin",
  "consent_required",
  "family_only",
  "class_not_created",
  "invalid_need",
  "math_unavailable",
  "exercise_invalid",
  "exercise_changed",
  "exercise_not_validated",
  "due_date_in_past",
  "invalid_label",
  "invalid_preference",
  "subscription_required",
  // Parcours famille autonome (fiche 0010).
  "family_exists",
  "family_full",
  "program_not_found",
  "programs_conflict",
  "program_required",
  "offer_country_mismatch",
]);

/**
 * Envoie une écriture, traduit l'erreur éventuelle et rafraîchit la page en
 * cas de succès (les données sont relues par les composants serveur).
 */
export function useMutation() {
  const t = useTranslations("errors");
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
      setError(KNOWN_ERRORS.has(result.code) ? t(result.code) : t("generic"));
    } else if (options.refresh !== false) {
      router.refresh();
    }
    return result;
  }

  return { run, pending, error, setError };
}
