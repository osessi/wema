"use client";

import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@wema/ui/components/ui/dialog";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@wema/ui/components/ui/select";
import { useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { read } from "../../lib/mutate";
import { useMutation } from "../../lib/use-mutation";

export interface AssignableExercise {
  id: string;
  objective: string;
  notionId: string;
  notionName: string | null;
  /** Notion du programme de la classe : proposée en premier. */
  inClass?: boolean;
}

export interface GiveResult {
  created: number;
  failed: number;
}

/** Valeur par défaut de l'échéance : dans 7 jours, 18 h, heure locale. */
function defaultDue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`;
}

/** « Donner un devoir » : un exercice validé, un titre, une échéance. */
export function GiveAssignmentDialog({
  classes,
  exercises,
  defaultIntentId,
  trigger,
  onDone,
}: {
  classes: { id: string; name: string }[];
  exercises: AssignableExercise[];
  defaultIntentId?: string;
  trigger: ReactNode;
  onDone?: (result: GiveResult) => void;
}) {
  const t = useTranslations("teacher.give");
  const id = useId();
  const { run, pending, error, setError } = useMutation();
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [intentId, setIntentId] = useState(defaultIntentId ?? "");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setError(null);
      setDue(defaultDue());
      const intent = exercises.find((x) => x.id === defaultIntentId);
      setIntentId(defaultIntentId ?? "");
      setTitle(intent?.objective.slice(0, 120) ?? "");
    }
  }

  function chooseExercise(value: string) {
    setIntentId(value);
    const intent = exercises.find((x) => x.id === value);
    if (intent && !title) setTitle(intent.objective.slice(0, 120));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const dueAt = new Date(due);
    if (Number.isNaN(dueAt.getTime())) return;
    const result = await run("POST", `/admin/classes/${classId}/assignments`, {
      intentId,
      title,
      dueAt: dueAt.toISOString(),
    });
    if (!result.ok) return;
    const created = read(result.data, "created");
    const failed = read(result.data, "failed");
    setOpen(false);
    onDone?.({
      created: typeof created === "number" ? created : 0,
      failed: Array.isArray(failed) ? failed.length : 0,
    });
  }

  // Regroupement par notion : celles de la classe d'abord.
  const groups = new Map<string, AssignableExercise[]>();
  for (const x of [...exercises].sort(
    (a, b) => Number(b.inClass ?? false) - Number(a.inClass ?? false),
  )) {
    const key = x.notionName ?? t("otherNotion");
    groups.set(key, [...(groups.get(key) ?? []), x]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          {classes.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-class`}>{t("class")}</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger id={`${id}-class`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-exercise`}>{t("exercise")}</Label>
            {exercises.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noExercise")}</p>
            ) : (
              <Select value={intentId} onValueChange={chooseExercise}>
                <SelectTrigger
                  id={`${id}-exercise`}
                  className="w-full whitespace-normal text-left"
                >
                  <SelectValue placeholder={t("chooseExercise")} />
                </SelectTrigger>
                <SelectContent>
                  {[...groups.entries()].map(([notion, list]) => (
                    <SelectGroup key={notion}>
                      <SelectLabel>{notion}</SelectLabel>
                      {list.map((x) => (
                        <SelectItem key={x.id} value={x.id}>
                          {x.objective}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-title`}>{t("assignmentTitle")}</Label>
            <Input
              id={`${id}-title`}
              value={title}
              maxLength={120}
              required
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-due`}>{t("due")}</Label>
            <Input
              id={`${id}-due`}
              type="datetime-local"
              value={due}
              required
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("variantsHint")}</p>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || !intentId || !classId || !title.trim()}
            >
              {pending ? t("giving") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
