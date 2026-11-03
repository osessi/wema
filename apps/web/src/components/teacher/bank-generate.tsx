"use client";

import { CircleNotch, Sparkle } from "@phosphor-icons/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { read } from "../../lib/mutate";
import { useMutation } from "../../lib/use-mutation";

interface Rejected {
  key: string;
  notionName: string;
  objective: string | null;
  reason: string;
}

interface Outcome {
  notions: number;
  proposed: number;
  rejected: Rejected[];
  failed: number;
}

const REASONS = [
  "invalid_format",
  "duplicate",
  "no_valid_parameters",
  "check_failed",
  "unknown_placeholder",
  "math_unavailable",
] as const;
type Reason = (typeof REASONS)[number];
const isReason = (v: string): v is Reason => REASONS.some((r) => r === v);

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Lit la réponse de POST /bank/generate sans `as`. */
function readOutcome(data: unknown): Outcome {
  const notions = read(data, "notions");
  return {
    notions: typeof notions === "number" ? notions : 0,
    proposed: list(read(data, "proposed")).length,
    failed: list(read(data, "failed")).length,
    rejected: list(read(data, "rejected")).map((r, i) => ({
      key: String(i),
      notionName: str(read(r, "notionName")) ?? "",
      objective: str(read(r, "objective")),
      reason: str(read(r, "reason")) ?? "",
    })),
  };
}

/** Demande à l'IA les propositions de la semaine ; seules les vérifiées entrent dans la banque. */
export function BankGenerate({ orgId, week }: { orgId: string; week: string }) {
  const t = useTranslations("teacher.bank.generate");
  const { run, pending } = useMutation();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setOutcome(null);
    setError(null);
    const r = await run("POST", `/admin/organizations/${orgId}/bank/generate`, {
      week,
    });
    if (r.ok) setOutcome(readOutcome(r.data));
    else if (r.code === "ai_not_configured" || r.code === "ai_unavailable")
      setError(t(r.code));
    else setError(t("error"));
  }

  return (
    <div className="space-y-3">
      <Button onClick={generate} disabled={pending}>
        {pending ? <CircleNotch className="animate-spin" /> : <Sparkle />}
        {pending ? t("pending") : t("button")}
      </Button>
      {pending && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("pendingHint")}
        </p>
      )}
      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {outcome && (
        <Alert aria-live="polite">
          <Sparkle />
          <AlertTitle>
            {outcome.notions === 0
              ? t("noNotion")
              : t("result", {
                  proposed: outcome.proposed,
                  rejected: outcome.rejected.length,
                })}
          </AlertTitle>
          <AlertDescription>
            {outcome.notions > 0 && <p>{t("resultHint")}</p>}
            {outcome.failed > 0 && (
              <p>{t("partial", { failed: outcome.failed })}</p>
            )}
            {outcome.rejected.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer">
                  {t("rejectedTitle")}
                </summary>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {outcome.rejected.map((r) => (
                    <li key={r.key}>
                      {r.notionName} · {r.objective ?? t("untitled")} :{" "}
                      {isReason(r.reason)
                        ? t(`reasons.${r.reason}`)
                        : t("reasons.other")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
