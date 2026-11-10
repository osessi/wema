"use client";

import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wema/ui/components/ui/select";
import { toast } from "@wema/ui/components/ui/sonner";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { PREFERENCE_KEYS, type PreferenceKeyUi } from "../../lib/teacher-types";
import { useMutation } from "../../lib/use-mutation";

const isKey = (v: string): v is PreferenceKeyUi =>
  PREFERENCE_KEYS.some((k) => k === v);

/**
 * Observation du prof sur la façon d'apprendre : ajoutée au journal de
 * l'élève comme déclaration (source « prof »), jamais écrite dans le profil.
 */
export function PreferenceForm({
  orgId,
  userId,
}: {
  orgId: string;
  userId: string;
}) {
  const t = useTranslations("teacher.preference");
  const id = useId();
  const { run, pending, error } = useMutation();
  const [key, setKey] = useState<PreferenceKeyUi>("format.examples");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState<"yes" | "no">("yes");
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setDone(false);
    const result = await run(
      "POST",
      `/admin/organizations/${orgId}/learners/${userId}/preferences`,
      {
        key,
        label: key === "interest" ? label : null,
        value: value === "yes",
      },
    );
    if (result.ok) {
      setDone(true);
      toast.success(t("saved"));
      setLabel("");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="min-w-0 space-y-4 rounded-lg border bg-background p-4"
    >
      <div>
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${id}-key`}>{t("key")}</Label>
          <Select value={key} onValueChange={(v) => isKey(v) && setKey(v)}>
            <SelectTrigger
              id={`${id}-key`}
              className="w-full min-w-0 *:data-[slot=select-value]:truncate"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PREFERENCE_KEYS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`keys.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${id}-value`}>{t("value")}</Label>
          <Select
            value={value}
            onValueChange={(v) => setValue(v === "no" ? "no" : "yes")}
          >
            <SelectTrigger
              id={`${id}-value`}
              className="w-full min-w-0 *:data-[slot=select-value]:truncate"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">{t("yes")}</SelectItem>
              <SelectItem value="no">{t("no")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {key === "interest" && (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-label`}>{t("label")}</Label>
          <Input
            id={`${id}-label`}
            value={label}
            maxLength={40}
            required
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {done && <p className="text-sm text-muted-foreground">{t("saved")}</p>}
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
