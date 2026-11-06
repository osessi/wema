"use client";

import { ArrowCounterClockwise, ArrowUUpLeft } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  type BalanceAction,
  balanceStep,
  equationOf,
  initialBalance,
  isIsolated,
  type Side,
} from "./balance-state";
import { BalanceDrawing } from "./figure";

/**
 * Balance à équations manipulable : on ajoute ou retire la même chose des
 * deux côtés, on partage les deux côtés. Tout se fait au clavier (boutons
 * et champ nombre) ; chaque geste réussi est signalé par `onUse` (indice utilisé).
 */
export function BalanceManipulable({
  left,
  right,
  variable,
  onUse,
}: {
  left: Side;
  right: Side;
  variable: string;
  onUse: () => void;
}) {
  const t = useTranslations("formats.balance");
  const id = useId();
  const [state, setState] = useState(() => initialBalance(left, right));
  const [n, setN] = useState(1);
  const [refused, setRefused] = useState(false);

  function act(action: BalanceAction) {
    const result = balanceStep(state, action);
    setRefused(!result.ok);
    if (!result.ok) return;
    setState(result.state);
    if (action.type !== "undo" && action.type !== "reset") onUse();
  }

  const equation = equationOf(state, variable);
  return (
    <div className="space-y-4">
      <svg
        viewBox="0 0 320 180"
        role="img"
        aria-label={t("drawing", { equation })}
        className="h-auto w-full max-w-md"
      >
        <BalanceDrawing
          left={state.left}
          right={state.right}
          variable={variable}
        />
      </svg>
      <p className="font-math text-xl" aria-live="polite">
        {equation}
      </p>
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-n`}>{t("amount")}</Label>
          <Input
            id={`${id}-n`}
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            value={n}
            className="w-24"
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10);
              setN(Number.isFinite(v) ? Math.min(50, Math.max(1, v)) : 1);
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => act({ type: "remove_units", n })}
        >
          {t("removeUnits", { n })}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => act({ type: "add_units", n })}
        >
          {t("addUnits", { n })}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => act({ type: "remove_unknowns", n })}
        >
          {t("removeUnknowns", { n, variable })}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => act({ type: "divide", n })}
        >
          {t("divide", { n })}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={state.history.length === 0}
          onClick={() => act({ type: "undo" })}
        >
          <ArrowUUpLeft />
          {t("undo")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={state.history.length === 0}
          onClick={() => act({ type: "reset" })}
        >
          <ArrowCounterClockwise />
          {t("reset")}
        </Button>
      </div>
      <div aria-live="polite" className="text-sm text-muted-foreground">
        {refused && <p>{t("refused")}</p>}
        {!refused && isIsolated(state) && <p>{t("isolated", { variable })}</p>}
      </div>
    </div>
  );
}
