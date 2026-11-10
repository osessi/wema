"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
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
import { Textarea } from "@wema/ui/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { read } from "../../lib/mutate";
import {
  type Exercise,
  type NotionInfo,
  TASK_KINDS,
  type TaskKind,
} from "../../lib/teacher-types";
import { useMutation } from "../../lib/use-mutation";

const NONE = "__none__";
const isTaskKind = (v: string): v is TaskKind =>
  TASK_KINDS.some((k) => k === v);

interface ParamDraft {
  key: number;
  name: string;
  ranges: { min: string; max: string }[];
  exclude: string;
}

const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

const toInt = (v: string) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

/** Formulaire d'un exercice (intention), selon le schéma de la tâche mathématique. */
export function ExerciseForm({
  orgId,
  notions,
  exercise,
}: {
  orgId: string;
  notions: NotionInfo[];
  /** Absent : création. */
  exercise?: Exercise;
}) {
  const t = useTranslations("teacher.form");
  const id = useId();
  const router = useRouter();
  const { run, pending, error, setError } = useMutation();
  const task = exercise?.task;
  const [notionId, setNotionId] = useState(exercise?.notionId ?? "");
  const [misconceptionId, setMisconceptionId] = useState(
    exercise?.misconceptionId ?? NONE,
  );
  const [objective, setObjective] = useState(exercise?.objective ?? "");
  const [statement, setStatement] = useState(exercise?.statement ?? "");
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? "solve");
  const [equation, setEquation] = useState(
    task?.kind === "solve" ? task.equation : "",
  );
  const [variable, setVariable] = useState(
    task?.kind === "solve" ? task.variable : "x",
  );
  const [expression, setExpression] = useState(
    task && task.kind !== "solve" ? task.expression : "",
  );
  const [round, setRound] = useState(
    task?.kind === "evaluate" && task.round !== undefined
      ? String(task.round)
      : "",
  );
  const [params, setParams] = useState<ParamDraft[]>(
    (exercise?.parameters ?? []).map((p, i) => ({
      key: i,
      name: p.name,
      ranges: p.ranges.map((r) => ({ min: String(r.min), max: String(r.max) })),
      exclude: p.exclude.join(", "),
    })),
  );
  const [constraints, setConstraints] = useState(
    (exercise?.constraints ?? []).join("\n"),
  );
  const [steps, setSteps] = useState((exercise?.steps ?? []).join("\n"));
  const [expected, setExpected] = useState(exercise?.expected ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const notion = notions.find((n) => n.id === notionId);
  const groups = new Map<string, NotionInfo[]>();
  for (const n of notions) {
    const key = `${n.countryName} · ${n.programLabel}`;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }

  const updateParam = (key: number, patch: Partial<ParamDraft>) =>
    setParams((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  function buildTask() {
    if (kind === "solve") return { kind, equation, variable };
    if (kind === "evaluate")
      return round === ""
        ? { kind, expression }
        : { kind, expression, round: Number(round) };
    return { kind, expression };
  }

  function buildParameters() {
    const out = [];
    for (const p of params) {
      if (!/^[a-z]{1,12}$/.test(p.name)) return null;
      const ranges = [];
      for (const r of p.ranges) {
        const min = toInt(r.min);
        const max = toInt(r.max);
        if (min === null || max === null || min > max) return null;
        ranges.push({ min, max });
      }
      const exclude = p.exclude
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v !== "")
        .map(toInt);
      if (exclude.some((v) => v === null)) return null;
      out.push({
        name: p.name,
        ranges,
        exclude: exclude.filter((v): v is number => v !== null),
      });
    }
    return out;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setError(null);
    const parameters = buildParameters();
    if (!parameters) {
      setLocalError(t("invalidParameters"));
      return;
    }
    const body = {
      notionId,
      objective,
      misconceptionId: misconceptionId === NONE ? null : misconceptionId,
      statement,
      task: buildTask(),
      parameters,
      constraints: lines(constraints),
      steps: lines(steps),
      expected: expected.trim() === "" ? null : expected.trim(),
    };
    const result = exercise
      ? await run("PATCH", `/admin/exercises/${exercise.id}`, body)
      : await run("POST", `/admin/organizations/${orgId}/exercises`, body, {
          refresh: false,
        });
    if (!result.ok) return;
    const newId = read(result.data, "id");
    if (!exercise && typeof newId === "string")
      router.push(`/prof/exercices/${newId}?org=${orgId}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="min-w-0 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="font-mono text-[11px] font-medium tracking-wider text-muted-foreground"
            >
              01
            </span>
            {t("what")}
          </CardTitle>
          <CardDescription>{t("whatHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor={`${id}-notion`}>{t("notion")}</Label>
            <Select
              value={notionId}
              onValueChange={(v) => {
                setNotionId(v);
                setMisconceptionId(NONE);
              }}
            >
              <SelectTrigger
                id={`${id}-notion`}
                className="w-full min-w-0 *:data-[slot=select-value]:truncate"
              >
                <SelectValue placeholder={t("chooseNotion")} />
              </SelectTrigger>
              <SelectContent>
                {[...groups.entries()].map(([label, list]) => (
                  <SelectGroup key={label}>
                    <SelectLabel>{label}</SelectLabel>
                    {list.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor={`${id}-mis`}>{t("misconception")}</Label>
            <Select
              value={misconceptionId}
              onValueChange={setMisconceptionId}
              disabled={!notion || notion.misconceptions.length === 0}
            >
              <SelectTrigger
                id={`${id}-mis`}
                className="w-full min-w-0 *:data-[slot=select-value]:truncate"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("noMisconception")}</SelectItem>
                {notion?.misconceptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5 md:col-span-2">
            <Label htmlFor={`${id}-objective`}>{t("objective")}</Label>
            <Input
              id={`${id}-objective`}
              value={objective}
              required
              maxLength={1000}
              placeholder={t("objectivePlaceholder")}
              onChange={(e) => setObjective(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="font-mono text-[11px] font-medium tracking-wider text-muted-foreground"
            >
              02
            </span>
            {t("task")}
          </CardTitle>
          <CardDescription>{t("taskHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor={`${id}-kind`}>{t("kind")}</Label>
            <Select
              value={kind}
              onValueChange={(v) => isTaskKind(v) && setKind(v)}
            >
              <SelectTrigger
                id={`${id}-kind`}
                className="w-full min-w-0 *:data-[slot=select-value]:truncate"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {kind === "solve" ? (
            <>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor={`${id}-var`}>{t("variable")}</Label>
                <Input
                  id={`${id}-var`}
                  value={variable}
                  required
                  maxLength={1}
                  pattern="[a-zA-Z]"
                  onChange={(e) => setVariable(e.target.value)}
                />
              </div>
              <div className="min-w-0 space-y-1.5 md:col-span-2">
                <Label htmlFor={`${id}-eq`}>{t("equation")}</Label>
                <Input
                  id={`${id}-eq`}
                  className="font-mono"
                  value={equation}
                  required
                  maxLength={500}
                  placeholder="Eq(a*x + b, c)"
                  onChange={(e) => setEquation(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("equationHint")}
                </p>
              </div>
            </>
          ) : (
            <>
              {kind === "evaluate" && (
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor={`${id}-round`}>{t("round")}</Label>
                  <Input
                    id={`${id}-round`}
                    type="number"
                    min={0}
                    max={6}
                    value={round}
                    placeholder={t("roundPlaceholder")}
                    onChange={(e) => setRound(e.target.value)}
                  />
                </div>
              )}
              <div className="min-w-0 space-y-1.5 md:col-span-2">
                <Label htmlFor={`${id}-expr`}>{t("expression")}</Label>
                <Input
                  id={`${id}-expr`}
                  className="font-mono"
                  value={expression}
                  required
                  maxLength={500}
                  placeholder={kind === "evaluate" ? "a**2" : "k*(x + a)"}
                  onChange={(e) => setExpression(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("expressionHint")}
                </p>
              </div>
            </>
          )}
          <div className="min-w-0 space-y-1.5 md:col-span-2">
            <Label htmlFor={`${id}-statement`}>{t("statement")}</Label>
            <Textarea
              id={`${id}-statement`}
              value={statement}
              required
              maxLength={1000}
              placeholder={t("statementPlaceholder")}
              onChange={(e) => setStatement(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("statementHint")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="font-mono text-[11px] font-medium tracking-wider text-muted-foreground"
            >
              03
            </span>
            {t("parameters")}
          </CardTitle>
          <CardDescription>{t("parametersHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {params.map((p) => (
            <fieldset key={p.key} className="space-y-3 rounded-lg border p-3">
              <legend className="sr-only">
                {t("parameter", { name: p.name })}
              </legend>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor={`${id}-p${p.key}-name`}>{t("name")}</Label>
                  <Input
                    id={`${id}-p${p.key}-name`}
                    className="w-28 font-mono"
                    value={p.name}
                    required
                    pattern="[a-z]{1,12}"
                    onChange={(e) =>
                      updateParam(p.key, { name: e.target.value })
                    }
                  />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor={`${id}-p${p.key}-exclude`}>
                    {t("exclude")}
                  </Label>
                  <Input
                    id={`${id}-p${p.key}-exclude`}
                    className="w-40"
                    value={p.exclude}
                    placeholder="0, 1"
                    onChange={(e) =>
                      updateParam(p.key, { exclude: e.target.value })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setParams((ps) => ps.filter((x) => x.key !== p.key))
                  }
                >
                  <Trash />
                  {t("removeParameter")}
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {p.ranges.map((r, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: une plage par niveau, dans l'ordre
                    key={i}
                    className="min-w-0 space-y-1.5"
                  >
                    <span className="text-sm font-medium">
                      {t("level", { level: i + 1 })}
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        aria-label={t("min", { level: i + 1 })}
                        value={r.min}
                        required
                        onChange={(e) =>
                          updateParam(p.key, {
                            ranges: p.ranges.map((x, j) =>
                              j === i ? { ...x, min: e.target.value } : x,
                            ),
                          })
                        }
                      />
                      <span aria-hidden="true">–</span>
                      <Input
                        type="number"
                        aria-label={t("max", { level: i + 1 })}
                        value={r.max}
                        required
                        onChange={(e) =>
                          updateParam(p.key, {
                            ranges: p.ranges.map((x, j) =>
                              j === i ? { ...x, max: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                {p.ranges.length < 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() =>
                      updateParam(p.key, {
                        ranges: [
                          ...p.ranges,
                          p.ranges.at(-1) ?? { min: "1", max: "9" },
                        ],
                      })
                    }
                  >
                    {t("addLevel")}
                  </Button>
                )}
                {p.ranges.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() =>
                      updateParam(p.key, { ranges: p.ranges.slice(0, -1) })
                    }
                  >
                    {t("removeLevel")}
                  </Button>
                )}
              </div>
            </fieldset>
          ))}
          {params.length < 10 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setParams((ps) => [
                  ...ps,
                  {
                    key: Math.max(-1, ...ps.map((x) => x.key)) + 1,
                    name: "",
                    ranges: [{ min: "1", max: "9" }],
                    exclude: "",
                  },
                ])
              }
            >
              <Plus />
              {t("addParameter")}
            </Button>
          )}
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor={`${id}-constraints`}>{t("constraints")}</Label>
            <Textarea
              id={`${id}-constraints`}
              className="font-mono"
              value={constraints}
              placeholder="Ne(a, 0)"
              onChange={(e) => setConstraints(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("constraintsHint")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="font-mono text-[11px] font-medium tracking-wider text-muted-foreground"
            >
              04
            </span>
            {t("guidance")}
          </CardTitle>
          <CardDescription>{t("guidanceHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor={`${id}-steps`}>{t("steps")}</Label>
            <Textarea
              id={`${id}-steps`}
              value={steps}
              rows={4}
              onChange={(e) => setSteps(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("stepsHint")}</p>
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor={`${id}-expected`}>{t("expected")}</Label>
            <Input
              id={`${id}-expected`}
              className="font-mono"
              value={expected}
              maxLength={300}
              onChange={(e) => setExpected(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("expectedHint")}</p>
          </div>
        </CardContent>
      </Card>

      {(localError ?? error) && (
        <Alert variant="destructive">
          <AlertDescription>{localError ?? error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !notionId}>
          {exercise ? t("save") : t("create")}
        </Button>
        <p className="text-sm text-muted-foreground">
          {exercise?.status === "validated" ? t("editResets") : t("draftHint")}
        </p>
      </div>
    </form>
  );
}
