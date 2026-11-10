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
import { SubjectLabel } from "@wema/ui/components/wema/subject-icon";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { read } from "../../lib/mutate";
import type { ProgramOption } from "../../lib/school-types";
import { useMutation } from "../../lib/use-mutation";

const NONE = "none";

/** Création d'une classe : un nom et un programme du référentiel. */
export function CreateClassForm({
  organizationId,
  programs,
  onCreated,
}: {
  organizationId: string;
  /** Programmes, avec l'icône de leur matière quand on la connaît. */
  programs: (ProgramOption & { icon?: string | null | undefined })[];
  /** Après la création (par défaut : ouvrir la classe dans l'espace École). */
  onCreated?: (classId: string) => Promise<void> | void;
}) {
  const t = useTranslations("school.classes");
  const router = useRouter();
  const { run, pending, error } = useMutation();
  const [name, setName] = useState("");
  const [programId, setProgramId] = useState(programs[0]?.id ?? NONE);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await run(
      "POST",
      `/admin/organizations/${organizationId}/classes`,
      { name, programId: programId === NONE ? null : programId },
      { refresh: false },
    );
    if (!result.ok) return;
    const id = read(result.data, "id");
    if (typeof id !== "string") return;
    if (onCreated) await onCreated(id);
    else router.push(`/ecole/${organizationId}/classes/${id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="class-name">{t("name")}</Label>
          <Input
            id="class-name"
            required
            maxLength={120}
            value={name}
            placeholder={t("namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="class-program">{t("program")}</Label>
          <Select value={programId} onValueChange={setProgramId}>
            <SelectTrigger id="class-program" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("noProgram")}</SelectItem>
              {programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <SubjectLabel icon={p.icon} size={22}>
                    {p.label}
                  </SubjectLabel>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("programHint")}</p>
        </div>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" variant="brand" disabled={pending || !name.trim()}>
        {t("create")}
      </Button>
    </form>
  );
}
