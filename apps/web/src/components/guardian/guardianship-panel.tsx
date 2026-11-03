"use client";

import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { Label } from "@wema/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wema/ui/components/ui/select";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { FamilyMembers } from "../../lib/guardian-types";
import { useMutation } from "../../lib/use-mutation";

/** Liens parent-enfant de la famille : qui suit qui. */
export function GuardianshipPanel({
  organizationId,
  members,
  guardians,
  links,
}: {
  organizationId: string;
  members: FamilyMembers;
  /** Membres qui peuvent suivre un enfant (rôle qui gère la famille). */
  guardians: readonly string[];
  /** Liens connus (ceux de l'utilisateur connecté). */
  links: { guardianId: string; learnerId: string; label: string }[];
}) {
  const t = useTranslations("guardian.family");
  const { run, pending, error } = useMutation();
  const [guardianId, setGuardianId] = useState("");
  const [learnerId, setLearnerId] = useState("");
  const base = `/admin/organizations/${organizationId}/guardianships`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await run("POST", base, { guardianId, learnerId });
    if (result.ok) {
      setGuardianId("");
      setLearnerId("");
    }
  }

  const select = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: FamilyMembers,
  ) => (
    <div className="min-w-48 flex-1 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={t("choose")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((m) => (
            <SelectItem key={m.userId} value={m.userId}>
              {m.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4">
      {links.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {links.map((l) => (
            <li
              key={`${l.guardianId}:${l.learnerId}`}
              className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
            >
              <span>{l.label}</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  run("DELETE", `${base}/${l.guardianId}/${l.learnerId}`)
                }
              >
                {t("unlink")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="space-y-3 rounded-lg border p-4">
        <h3 className="font-medium">{t("linkTitle")}</h3>
        <div className="flex flex-wrap items-end gap-3">
          {select(
            "link-guardian",
            t("guardian"),
            guardianId,
            setGuardianId,
            members.filter((m) => guardians.includes(m.userId)),
          )}
          {select(
            "link-learner",
            t("learner"),
            learnerId,
            setLearnerId,
            members.filter((m) => !guardians.includes(m.userId)),
          )}
          <Button
            type="submit"
            variant="outline"
            disabled={
              pending || !guardianId || !learnerId || guardianId === learnerId
            }
          >
            {t("link")}
          </Button>
        </div>
      </form>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
