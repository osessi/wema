"use client";

import {
  ArrowCounterClockwise,
  Brain,
  Lightning,
  ListBullets,
  PencilSimple,
  Robot,
} from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { toast } from "@wema/ui/components/ui/sonner";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { AiRoutingData } from "../../../lib/admin-ai-types";
import { read } from "../../../lib/mutate";
import { useMutation } from "../../../lib/use-mutation";
import { Notice, SelectField } from "../_ui/fields";
import { Code, Panel } from "../_ui/kit";
import { ModelList } from "./model-list";

type Routing = AiRoutingData["routing"];

type Values = {
  provider: Routing["provider"];
  reasoning: string[];
  economic: string[];
  tasks: Record<string, string[]>;
};

const same = (a: Values, b: Values) => JSON.stringify(a) === JSON.stringify(b);

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
  const init = (r: Routing): Values => ({
    provider: r.provider,
    reasoning: [...r.tiers.reasoning],
    economic: [...r.tiers.economic],
    tasks: Object.fromEntries(
      taskNames.map((task) => [task, [...(r.tasks[task] ?? [])]]),
    ),
  });
  const [saved, setSaved] = useState<Values>(() => init(data.routing));
  const [values, setValues] = useState<Values>(saved);
  const [editing, setEditing] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const dirty = !same(values, saved);
  const tierName = (tier: string) =>
    t(tier === "economic" ? "ai.economic" : "ai.reasoning");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setIssues([]);
    const tasks = Object.fromEntries(
      Object.entries(values.tasks).filter(([, list]) => list.length > 0),
    );
    const result = await run("PUT", "/admin/ai/routing", {
      provider: values.provider,
      tiers: { reasoning: values.reasoning, economic: values.economic },
      tasks,
    });
    if (result.ok) {
      setSaved(values);
      setEditing(null);
      toast.success(t("common.saved"));
    } else setIssues(issueMessages(result.details));
  }

  const tiers = [
    { key: "reasoning", Icon: Brain, badge: "brand" },
    { key: "economic", Icon: Lightning, badge: "info" },
  ] as const;

  return (
    <form className="flex flex-col gap-6" onSubmit={submit}>
      {!data.configured && (
        <Notice tone="warning">{t("ai.notConfigured")}</Notice>
      )}
      {data.storedInvalid && (
        <Notice tone="warning">{t("ai.storedInvalid")}</Notice>
      )}
      <Panel
        icon={<Robot weight="fill" />}
        tone="yellow"
        title={t("ai.routingTitle")}
        description={t("ai.routingText")}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setValues(init(data.defaults))}
          >
            <ArrowCounterClockwise aria-hidden />
            {t("ai.reset")}
          </Button>
        }
        contentClassName="flex flex-col gap-6"
      >
        <SelectField
          label={t("ai.provider")}
          className="max-w-xs"
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
        <div className="grid gap-4 md:grid-cols-2">
          {tiers.map((tier) => (
            <section
              key={tier.key}
              aria-labelledby={`tier-${tier.key}`}
              className="flex h-full flex-col gap-3 rounded-card border bg-muted/30 p-4"
            >
              <div className="flex items-center gap-2.5">
                <GlowTile
                  tone={tier.key === "reasoning" ? "yellow" : "sky"}
                  size={28}
                  glyph="58%"
                >
                  <tier.Icon weight="fill" />
                </GlowTile>
                <h3 id={`tier-${tier.key}`} className="text-sm font-semibold">
                  {tierName(tier.key)}
                </h3>
                <Badge variant="neutral" className="ml-auto tabular-nums">
                  {t("ai.modelCount", { count: values[tier.key].length })}
                </Badge>
              </div>
              <ModelList
                label={tierName(tier.key)}
                models={values[tier.key]}
                onChange={(list) => setValues({ ...values, [tier.key]: list })}
                disabled={pending}
              />
              {values[tier.key].length === 0 ? (
                <p className="text-xs text-destructive" role="alert">
                  {t("ai.models.required")}
                </p>
              ) : null}
            </section>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("ai.modelsHint")}</p>
      </Panel>

      <Panel
        icon={<ListBullets weight="bold" />}
        tone="slate"
        title={t("ai.tasksTitle")}
        description={t("ai.tasksText")}
        flush
      >
        <ul className="divide-y">
          {taskTiers.map(([task, tier]) => {
            const list = values.tasks[task] ?? [];
            const open = editing === task;
            const name = t.has(`ai.taskNames.${task}`)
              ? t(`ai.taskNames.${task}`)
              : task;
            return (
              <li key={task} className="px-4 py-2.5 sm:px-6">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex min-w-[min(100%,14rem)] flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="text-sm font-medium">{name}</span>
                    <Code className="w-fit text-[11px] text-muted-foreground">
                      {task}
                    </Code>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {list.length === 0 ? (
                      <Badge variant={tier === "economic" ? "info" : "brand"}>
                        {t("ai.tierDefault", { tier: tierName(tier) })}
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="warning">{t("ai.custom")}</Badge>
                        <Code className="max-w-[16rem] truncate">
                          {list[0]}
                        </Code>
                        {list.length > 1 ? (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {t("ai.moreFallbacks", { count: list.length - 1 })}
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={open ? "secondary" : "ghost"}
                    aria-expanded={open}
                    onClick={() => setEditing(open ? null : task)}
                  >
                    <PencilSimple aria-hidden />
                    {open ? t("common.close") : t("ai.customize")}
                    <span className="sr-only"> · {name}</span>
                  </Button>
                </div>
                {open ? (
                  <div className="mt-3 flex flex-col gap-2 rounded-card border bg-muted/30 p-3">
                    <ModelList
                      label={name}
                      models={list}
                      disabled={pending}
                      onChange={(next) =>
                        setValues({
                          ...values,
                          tasks: { ...values.tasks, [task]: next },
                        })
                      }
                    />
                    {list.length > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="link"
                        className="w-fit px-0"
                        onClick={() =>
                          setValues({
                            ...values,
                            tasks: { ...values.tasks, [task]: [] },
                          })
                        }
                      >
                        {t("ai.useTier", { tier: tierName(tier) })}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Panel>

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
      {dirty ? (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-card border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
          <span className="flex items-center gap-2 text-sm">
            <Badge variant="warning">{t("ai.unsavedBadge")}</Badge>
            {t("ai.unsaved")}
          </span>
          <span className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setValues(saved)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={
                pending ||
                values.reasoning.length === 0 ||
                values.economic.length === 0
              }
            >
              {t("common.save")}
            </Button>
          </span>
        </div>
      ) : null}
    </form>
  );
}
