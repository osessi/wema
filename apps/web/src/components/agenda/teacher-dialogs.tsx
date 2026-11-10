"use client";

import { Button } from "@wema/ui/components/ui/button";
import { Checkbox } from "@wema/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wema/ui/components/ui/dialog";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@wema/ui/components/ui/native-select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@wema/ui/components/ui/toggle-group";
import { useTranslations } from "next-intl";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";
import { atClock, browserTimeZone, clock, dayKey, isoWeekday } from "./dates";
import type { Group, Notion, TeacherLearner } from "./types";
import { useAgendaMutation } from "./use-agenda";

const DURATIONS = [30, 45, 60, 90, 120];

/** Fenêtre de formulaire commune : titre, aide, erreur, boutons. */
function FormDialog({
  open,
  onOpenChange,
  title,
  hint,
  error,
  pending,
  submitDisabled,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  hint: string;
  error: string | null;
  pending: boolean;
  submitDisabled?: boolean;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("agenda.actions");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{hint}</DialogDescription>
          </DialogHeader>
          {children}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("close")}
            </Button>
            <Button type="submit" disabled={pending || submitDisabled}>
              {pending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Date, heure de début et durée d'une séance (dans le fuseau de l'appareil). */
export function SessionTimeFields({
  value,
  onChange,
}: {
  value: { day: string; time: string; minutes: number };
  onChange: (v: { day: string; time: string; minutes: number }) => void;
}) {
  const t = useTranslations("agenda");
  const ids = { day: useId(), time: useId(), minutes: useId() };
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="space-y-2">
        <Label htmlFor={ids.day}>{t("planDialog.date")}</Label>
        <Input
          id={ids.day}
          type="date"
          required
          value={value.day}
          onChange={(e) => onChange({ ...value, day: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={ids.time}>{t("planDialog.start")}</Label>
        <Input
          id={ids.time}
          type="time"
          step={300}
          required
          value={value.time}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={ids.minutes}>{t("planDialog.duration")}</Label>
        <NativeSelect
          id={ids.minutes}
          value={String(value.minutes)}
          onChange={(e) =>
            onChange({ ...value, minutes: Number(e.target.value) })
          }
        >
          {DURATIONS.map((m) => (
            <NativeSelectOption key={m} value={m}>
              {t("ruleDialog.minutes", { count: m })}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}

/** Début et fin en ISO, ou `null` si la date ou l'heure est invalide. */
export function toRange(v: { day: string; time: string; minutes: number }) {
  const start = atClock(v.day, v.time);
  if (!start) return null;
  return {
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + v.minutes * 60_000).toISOString(),
  };
}

/** Ajouter une disponibilité récurrente, dans le fuseau de l'appareil du prof. */
export function AvailabilityDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("agenda");
  const letters: string[] = t.raw("weekdaysShort");
  const { run, pending, error, setError } = useAgendaMutation();
  const ids = {
    start: useId(),
    end: useId(),
    from: useId(),
    until: useId(),
    every: useId(),
    slot: useId(),
  };
  const [form, setForm] = useState({
    weekdays: [String(isoWeekday(new Date()))],
    startTime: "17:00",
    endTime: "19:00",
    validFrom: dayKey(new Date()),
    validUntil: "",
    everyNWeeks: 1,
    slotMinutes: 60,
  });
  useEffect(() => {
    if (open) setError(null);
  }, [open, setError]);

  async function save() {
    const result = await run("POST", "/availability", {
      weekdays: form.weekdays.map(Number),
      startTime: form.startTime,
      endTime: form.endTime,
      timeZone: browserTimeZone(),
      validFrom: form.validFrom,
      validUntil: form.validUntil || null,
      everyNWeeks: form.everyNWeeks,
      slotMinutes: form.slotMinutes,
    });
    if (result.ok) onOpenChange(false);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("ruleDialog.title")}
      hint={t("ruleDialog.hint", { zone: browserTimeZone() })}
      error={error}
      pending={pending}
      submitDisabled={form.weekdays.length === 0}
      onSubmit={save}
    >
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("ruleDialog.days")}</p>
        <ToggleGroup
          type="multiple"
          variant="outline"
          value={form.weekdays}
          onValueChange={(weekdays) => setForm({ ...form, weekdays })}
          className="flex-wrap"
        >
          {letters.map((l, i) => (
            <ToggleGroupItem key={l} value={String(i + 1)} aria-label={l}>
              {l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={ids.start}>{t("ruleDialog.start")}</Label>
          <Input
            id={ids.start}
            type="time"
            step={300}
            required
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={ids.end}>{t("ruleDialog.end")}</Label>
          <Input
            id={ids.end}
            type="time"
            step={300}
            required
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={ids.from}>{t("ruleDialog.from")}</Label>
          <Input
            id={ids.from}
            type="date"
            required
            value={form.validFrom}
            onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={ids.until}>{t("ruleDialog.until")}</Label>
          <Input
            id={ids.until}
            type="date"
            min={form.validFrom}
            value={form.validUntil}
            onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={ids.every}>{t("ruleDialog.every")}</Label>
          <NativeSelect
            id={ids.every}
            value={String(form.everyNWeeks)}
            onChange={(e) =>
              setForm({ ...form, everyNWeeks: Number(e.target.value) })
            }
          >
            {[1, 2, 3, 4].map((n) => (
              <NativeSelectOption key={n} value={n}>
                {t("ruleDialog.everyOption", { count: n })}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor={ids.slot}>{t("ruleDialog.slot")}</Label>
          <NativeSelect
            id={ids.slot}
            value={String(form.slotMinutes)}
            onChange={(e) =>
              setForm({ ...form, slotMinutes: Number(e.target.value) })
            }
          >
            {DURATIONS.map((m) => (
              <NativeSelectOption key={m} value={m}>
                {t("ruleDialog.minutes", { count: m })}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
    </FormDialog>
  );
}

/** Le prof planifie une séance avec un élève ou un groupe. */
export function PlanSessionDialog({
  open,
  onOpenChange,
  learners,
  groups,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  learners: TeacherLearner[];
  groups: Group[];
  initial: { day: string; time: string } | null;
}) {
  const t = useTranslations("agenda");
  const { run, pending, error, setError } = useAgendaMutation();
  const ids = { who: useId(), title: useId() };
  const [who, setWho] = useState("");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState({ day: "", time: "17:00", minutes: 60 });
  useEffect(() => {
    if (!open) return;
    setError(null);
    const next = new Date(Date.now() + 3_600_000);
    next.setMinutes(0, 0, 0);
    setWhen({
      day: initial?.day ?? dayKey(next),
      time: initial?.time ?? clock(next),
      minutes: 60,
    });
  }, [open, initial, setError]);

  // Un élève peut être dans plusieurs classes du prof : une seule entrée par élève.
  const people = [...new Map(learners.map((l) => [l.learnerId, l])).values()];

  async function save() {
    const range = toRange(when);
    const [kind, id] = who.split(":");
    if (!range || !id) return;
    const result = await run("POST", "/sessions", {
      target:
        kind === "group"
          ? { kind: "group", groupId: id }
          : { kind: "individual", learnerId: id },
      title: title.trim() || null,
      ...range,
    });
    if (result.ok) {
      setWho("");
      setTitle("");
      onOpenChange(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("planDialog.title")}
      hint={t("planDialog.hint")}
      error={error}
      pending={pending}
      submitDisabled={!who}
      onSubmit={save}
    >
      <div className="space-y-2">
        <Label htmlFor={ids.who}>{t("planDialog.who")}</Label>
        <NativeSelect
          id={ids.who}
          value={who}
          onChange={(e) => setWho(e.target.value)}
          required
        >
          <NativeSelectOption value="" disabled>
            {t("planDialog.choose")}
          </NativeSelectOption>
          <optgroup label={t("planDialog.learners")}>
            {people.map((l) => (
              <NativeSelectOption
                key={l.learnerId}
                value={`learner:${l.learnerId}`}
              >
                {t("planDialog.learnerOption", {
                  name: l.displayName,
                  className: l.className,
                })}
              </NativeSelectOption>
            ))}
          </optgroup>
          {groups.length > 0 && (
            <optgroup label={t("planDialog.groups")}>
              {groups.map((g) => (
                <NativeSelectOption key={g.id} value={`group:${g.id}`}>
                  {t("planDialog.groupOption", {
                    name: g.name,
                    count: g.members.length,
                  })}
                </NativeSelectOption>
              ))}
            </optgroup>
          )}
        </NativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor={ids.title}>{t("planDialog.titleField")}</Label>
        <Input
          id={ids.title}
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <SessionTimeFields value={when} onChange={setWhen} />
    </FormDialog>
  );
}

/** Créer ou modifier un groupe de révision. */
export function GroupDialog({
  open,
  onOpenChange,
  learners,
  notions,
  group,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  learners: TeacherLearner[];
  notions: Notion[];
  group: Group | null;
}) {
  const t = useTranslations("agenda.groupDialog");
  const { run, pending, error, setError } = useAgendaMutation();
  const ids = { name: useId(), notion: useId() };
  const [name, setName] = useState("");
  const [notionId, setNotionId] = useState("");
  const [members, setMembers] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(group?.name ?? "");
    setNotionId(group?.notionId ?? "");
    setMembers(new Set(group?.members.map((m) => m.learnerId) ?? []));
  }, [open, group, setError]);

  const byClass = new Map<string, TeacherLearner[]>();
  for (const l of learners)
    byClass.set(l.className, [...(byClass.get(l.className) ?? []), l]);

  async function save() {
    const result = await run("POST", "/groups", {
      ...(group ? { id: group.id } : {}),
      name: name.trim(),
      notionId: notionId || null,
      learnerIds: [...members],
    });
    if (result.ok) onOpenChange(false);
  }

  const toggle = (id: string, on: boolean) => {
    const next = new Set(members);
    if (on) next.add(id);
    else next.delete(id);
    setMembers(next);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      hint={t("hint")}
      error={error}
      pending={pending}
      submitDisabled={!name.trim() || members.size === 0}
      onSubmit={save}
    >
      <div className="space-y-2">
        <Label htmlFor={ids.name}>{t("name")}</Label>
        <Input
          id={ids.name}
          value={name}
          required
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={ids.notion}>{t("notion")}</Label>
        <NativeSelect
          id={ids.notion}
          value={notionId}
          onChange={(e) => setNotionId(e.target.value)}
        >
          <NativeSelectOption value="">{t("noNotion")}</NativeSelectOption>
          {notions.map((n) => (
            <NativeSelectOption key={n.id} value={n.id}>
              {n.name} · {n.className}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("learners")}</legend>
        {learners.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noLearners")}</p>
        )}
        {[...byClass].map(([className, list]) => (
          <div key={className} className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {className}
            </p>
            {list.map((l) => {
              const id = `g-${l.classId}-${l.learnerId}`;
              return (
                <div key={id} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={members.has(l.learnerId)}
                    onCheckedChange={(v) => toggle(l.learnerId, v === true)}
                  />
                  <Label htmlFor={id} className="font-normal">
                    {l.displayName}
                  </Label>
                </div>
              );
            })}
          </div>
        ))}
      </fieldset>
    </FormDialog>
  );
}

/** Le prof propose un autre horaire (séance individuelle) ou déplace une séance de groupe. */
export function RescheduleDialog({
  open,
  onOpenChange,
  sessionId,
  group,
  startsAt,
  endsAt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  group: boolean;
  startsAt: string;
  endsAt: string;
}) {
  const t = useTranslations("agenda");
  const { run, pending, error, setError } = useAgendaMutation();
  const [when, setWhen] = useState({ day: "", time: "", minutes: 60 });
  useEffect(() => {
    if (!open) return;
    setError(null);
    const start = new Date(startsAt);
    const minutes = Math.round(
      (new Date(endsAt).getTime() - start.getTime()) / 60_000,
    );
    setWhen({
      day: dayKey(start),
      time: clock(start),
      minutes: DURATIONS.includes(minutes) ? minutes : 60,
    });
  }, [open, startsAt, endsAt, setError]);

  async function save() {
    const range = toRange(when);
    if (!range) return;
    const result = await run(
      "POST",
      `/sessions/${sessionId}/reschedule`,
      range,
    );
    if (result.ok) onOpenChange(false);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(group ? "actions.rescheduleGroup" : "rescheduleDialog.title")}
      hint={t(group ? "rescheduleDialog.hintGroup" : "rescheduleDialog.hint")}
      error={error}
      pending={pending}
      onSubmit={save}
    >
      <SessionTimeFields value={when} onChange={setWhen} />
    </FormDialog>
  );
}
