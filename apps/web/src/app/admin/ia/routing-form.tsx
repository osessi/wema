"use client";

import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { AiRoutingData } from "../../../lib/admin-ai-types";
import { read } from "../../../lib/mutate";
import { useMutation } from "../../../lib/use-mutation";
import { Notice, SelectField, TextField } from "../_ui/fields";

type Routing = AiRoutingData["routing"];

// Une liste de modèles se saisit séparée par des virgules ; le premier est
// essayé d'abord, les suivants servent de secours.
const toText = (models: readonly string[] | undefined) =>
  (models ?? []).join(", ");
const toList = (text: string) =>
  text
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

function issueMessages(details: unknown): string[] {
  if (!Array.isArray(details)) return [];
  return details.flatMap((d: unknown) => {
    const path = read(d, "path");
    const message = read(d, "message");
    return typeof message === "string"
      ? [typeof path === "string" && path ? `${path} : ${message}` : message]
      : [];
  });
}

/** Routage de la passerelle IA : fournisseur, modèles par palier, exceptions. */
export function RoutingForm({ data }: { data: AiRoutingData }) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const taskTiers = Object.entries(data.tasks);
  const taskNames = taskTiers.map(([task]) => task);
  const init = (r: Routing) => ({
    provider: r.provider,
    reasoning: toText(r.tiers.reasoning),
    economic: toText(r.tiers.economic),
    tasks: Object.fromEntries(
      taskNames.map((task) => [task, toText(r.tasks[task])]),
    ),
  });
  const [values, setValues] = useState(() => init(data.routing));
  const [issues, setIssues] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    setIssues([]);
    const tasks = Object.fromEntries(
      Object.entries(values.tasks)
        .map(([task, text]) => [task, toList(text)] as const)
        .filter(([, list]) => list.length > 0),
    );
    const result = await run("PUT", "/admin/ai/routing", {
      provider: values.provider,
      tiers: {
        reasoning: toList(values.reasoning),
        economic: toList(values.economic),
      },
      tasks,
    });
    if (result.ok) setSaved(true);
    else setIssues(issueMessages(result.details));
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      {!data.configured && (
        <Notice tone="warning">{t("ai.notConfigured")}</Notice>
      )}
      {data.storedInvalid && (
        <Notice tone="warning">{t("ai.storedInvalid")}</Notice>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">
            {t("ai.routingTitle")}
          </CardTitle>
          <CardDescription>{t("ai.routingText")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <SelectField
            label={t("ai.provider")}
            value={values.provider}
            onChange={(e) => {
              const provider = e.target.value;
              if (provider === "openrouter" || provider === "ai-sdk")
                setValues({ ...values, provider });
            }}
          >
            <option value="openrouter">OpenRouter</option>
            <option value="ai-sdk">AI SDK</option>
          </SelectField>
          <div className="hidden md:block" />
          <TextField
            label={t("ai.reasoning")}
            hint={t("ai.modelsHint")}
            required
            value={values.reasoning}
            onChange={(e) =>
              setValues({ ...values, reasoning: e.target.value })
            }
          />
          <TextField
            label={t("ai.economic")}
            hint={t("ai.modelsHint")}
            required
            value={values.economic}
            onChange={(e) => setValues({ ...values, economic: e.target.value })}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">
            {t("ai.tasksTitle")}
          </CardTitle>
          <CardDescription>{t("ai.tasksText")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {taskTiers.map(([task, tier]) => (
            <TextField
              key={task}
              label={
                t.has(`ai.taskNames.${task}`) ? t(`ai.taskNames.${task}`) : task
              }
              hint={task}
              placeholder={t("ai.tierDefault", {
                tier: t(tier === "economic" ? "ai.economic" : "ai.reasoning"),
              })}
              value={values.tasks[task] ?? ""}
              onChange={(e) =>
                setValues({
                  ...values,
                  tasks: { ...values.tasks, [task]: e.target.value },
                })
              }
            />
          ))}
        </CardContent>
      </Card>
      {error ? (
        <Notice tone="error">
          {error}
          {issues.length > 0 ? (
            <ul className="mt-1.5 list-disc pl-5">
              {issues.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}
      {saved ? <Notice tone="success">{t("common.saved")}</Notice> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {t("common.save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setValues(init(data.defaults));
            setSaved(false);
          }}
        >
          {t("ai.reset")}
        </Button>
      </div>
    </form>
  );
}
