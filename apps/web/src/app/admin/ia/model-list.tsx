"use client";

import { ArrowDown, ArrowUp, Plus, XIcon } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { Input } from "@wema/ui/components/ui/input";
import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useId, useState } from "react";

/** Même règle que la passerelle (`packages/ai-gateway/src/routing.ts`). */
const MODEL_ID = /^[~@]?[a-z0-9][a-z0-9._:/@~-]{1,120}$/i;
export const MAX_MODELS = 5;

/**
 * Liste ordonnée de modèles : le premier est essayé d'abord, les suivants
 * servent de secours. Ajout par Entrée, validation en direct, réordonnancement
 * par flèches (accessible au clavier).
 */
export function ModelList({
  label,
  models,
  onChange,
  disabled,
}: {
  label: string;
  models: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("ai.models");
  const id = useId();
  const [draft, setDraft] = useState("");
  const value = draft.trim();
  const problem =
    value === ""
      ? null
      : !MODEL_ID.test(value)
        ? t("invalid")
        : models.includes(value)
          ? t("duplicate")
          : models.length >= MAX_MODELS
            ? t("tooMany", { max: MAX_MODELS })
            : null;

  const add = () => {
    if (value === "" || problem) return;
    onChange([...models, value]);
    setDraft("");
  };
  const move = (from: number, to: number) => {
    const next = [...models];
    const [item] = next.splice(from, 1);
    if (item === undefined) return;
    next.splice(to, 0, item);
    onChange(next);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {models.length > 0 ? (
        <ol aria-label={label} className="flex flex-col gap-1.5">
          {models.map((m, i) => (
            <li
              key={m}
              className="flex items-center gap-2 rounded-lg border bg-background py-1 pr-1 pl-1.5"
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-[6px] font-mono text-[11px] font-medium tabular-nums",
                  i === 0
                    ? "bg-brand-soft text-brand-text"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-[12.5px]">
                {m}
              </code>
              <span className="hidden font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase sm:inline">
                {i === 0 ? t("primary") : t("fallback")}
              </span>
              <span className="flex shrink-0 items-center">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("up", { model: m })}
                  disabled={disabled || i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("down", { model: m })}
                  disabled={disabled || i === models.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("remove", { model: m })}
                  disabled={disabled}
                  onClick={() => onChange(models.filter((x) => x !== m))}
                >
                  <XIcon />
                </Button>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {models.length < MAX_MODELS ? (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor={id} className="sr-only">
              {t("addLabel", { list: label })}
            </label>
            <Input
              id={id}
              value={draft}
              placeholder={t("placeholder")}
              disabled={disabled}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? `${id}-problem` : undefined}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              className="font-mono text-[12.5px]"
            />
            {problem ? (
              <p
                id={`${id}-problem`}
                className="mt-1.5 text-xs text-destructive"
                role="alert"
              >
                {problem}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || value === "" || problem !== null}
            onClick={add}
          >
            <Plus aria-hidden weight="bold" />
            {t("add")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
