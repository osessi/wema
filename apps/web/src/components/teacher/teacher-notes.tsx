"use client";

import { NotePencil } from "@phosphor-icons/react";
import { TEACHER_NOTE_MAX } from "@wema/domain";
import { GlowTile } from "@wema/ui/brand";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { Label } from "@wema/ui/components/ui/label";
import { toast } from "@wema/ui/components/ui/sonner";
import { Textarea } from "@wema/ui/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { type FormEvent, useId, useRef, useState } from "react";
import { mutate } from "../../lib/mutate";
import { DictateButton } from "../learner/voice/dictate-button";

export interface TeacherNote {
  id: string;
  text: string;
  at: string;
}

const KNOWN = new Set([
  "health_note",
  "personal_data_note",
  "invalid_note",
  "forbidden",
  "network",
]);

/**
 * Notes libres du prof sur l'élève, écrites ou dictées. Chaque note entre au
 * journal comme observation du prof ; le prof IA la lit comme une donnée.
 */
export function TeacherNotes({
  orgId,
  userId,
  notes,
  canWrite,
}: {
  orgId: string;
  userId: string;
  notes: readonly TeacherNote[];
  canWrite: boolean;
}) {
  const t = useTranslations("teacher.notes");
  const format = useFormatter();
  const router = useRouter();
  const id = useId();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const beforeDictation = useRef("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim() === "") return;
    setPending(true);
    setError(null);
    const result = await mutate(
      "POST",
      `/admin/organizations/${orgId}/learners/${userId}/notes`,
      { text },
    );
    setPending(false);
    if (!result.ok) {
      setError(t(`errors.${KNOWN.has(result.code) ? result.code : "generic"}`));
      return;
    }
    setText("");
    toast.success(t("saved"));
    router.refresh();
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-4 rounded-card border bg-card p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <GlowTile tone="amber" size={40}>
          <NotePencil weight="fill" />
        </GlowTile>
        <div className="min-w-0 space-y-1">
          <h2 className="font-semibold tracking-tight">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("hint")}</p>
        </div>
      </div>

      {canWrite && (
        <form onSubmit={submit} className="space-y-3">
          <Label htmlFor={`${id}-note`} className="sr-only">
            {t("label")}
          </Label>
          <Textarea
            id={`${id}-note`}
            value={text}
            rows={3}
            maxLength={TEACHER_NOTE_MAX}
            placeholder={t("placeholder")}
            onChange={(e) => setText(e.target.value)}
          />
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <DictateButton
              disabled={pending}
              onStart={() => {
                beforeDictation.current = text.trim();
              }}
              onText={(spoken) =>
                setText(
                  [beforeDictation.current, spoken]
                    .filter((s) => s !== "")
                    .join(" ")
                    .slice(0, TEACHER_NOTE_MAX),
                )
              }
            />
            <Button
              type="submit"
              variant="outline"
              disabled={pending || text.trim() === ""}
            >
              {t("submit")}
            </Button>
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-2" aria-label={t("list")}>
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-lg border bg-background p-3 text-sm"
            >
              <p className="whitespace-pre-wrap">{n.text}</p>
              <p
                className="mt-1 text-xs text-muted-foreground"
                suppressHydrationWarning
              >
                {format.dateTime(new Date(n.at), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
