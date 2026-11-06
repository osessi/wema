"use client";

import { Archive, Books, Eye, SealCheck } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@wema/ui/components/ui/dialog";
import { Label } from "@wema/ui/components/ui/label";
import { Switch } from "@wema/ui/components/ui/switch";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@wema/ui/components/ui/toggle-group";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { read } from "../../lib/mutate";
import { useMutation } from "../../lib/use-mutation";
import { PreviewFormats } from "../formats/preview-formats";

/** Détail d'un échec de vérification par services/math, lisible par le prof. */
function useFailureText() {
  const t = useTranslations("teacher.check");
  return (details: unknown): string | null => {
    const kind = read(details, "kind");
    const level = read(details, "level");
    const at = typeof level === "number" ? t("atLevel", { level }) : "";
    if (kind === "check_failed") {
      const reason = read(details, "reason");
      const known = [
        "constraint_failed",
        "no_solution",
        "mismatch",
        "invalid_input",
        "unsupported",
        "too_complex",
      ];
      return `${typeof reason === "string" && known.includes(reason) ? t(`reasons.${reason}`) : t("reasons.unknown")}${at}`;
    }
    if (kind === "no_valid_parameters") return `${t("noParameters")}${at}`;
    if (kind === "unknown_placeholder") {
      const name = read(details, "name");
      return t("unknownPlaceholder", {
        name: typeof name === "string" ? name : "?",
      });
    }
    return null;
  };
}

/** Vérifie l'exercice par services/math (une variante par niveau) et le valide. */
export function ValidateButton({ exerciseId }: { exerciseId: string }) {
  const t = useTranslations("teacher.check");
  const { run, pending, error } = useMutation();
  const failure = useFailureText();
  const [detail, setDetail] = useState<string | null>(null);
  const [samples, setSamples] = useState<string[]>([]);

  async function validate() {
    setDetail(null);
    setSamples([]);
    const result = await run("POST", `/admin/exercises/${exerciseId}/validate`);
    if (!result.ok) {
      setDetail(failure(result.details));
      return;
    }
    const list = read(result.data, "samples");
    if (Array.isArray(list))
      setSamples(
        list
          .map((s) => read(s, "statement"))
          .filter((s): s is string => typeof s === "string"),
      );
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={validate}>
        <SealCheck />
        {pending ? t("checking") : t("validate")}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            {detail && <span className="block">{detail}</span>}
          </AlertDescription>
        </Alert>
      )}
      {samples.length > 0 && (
        <Alert>
          <AlertDescription>
            {t("validated")}
            <ul className="mt-1 list-disc pl-4">
              {samples.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function ArchiveButton({ exerciseId }: { exerciseId: string }) {
  const t = useTranslations("teacher.library");
  const { run, pending, error } = useMutation();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (window.confirm(t("archiveConfirm")))
            run("POST", `/admin/exercises/${exerciseId}/archive`);
        }}
      >
        <Archive />
        {t("archive")}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}

/** Ajoute un exercice validé à la banque de la semaine. */
export function ProposeButton({
  orgId,
  exerciseId,
  week,
}: {
  orgId: string;
  exerciseId: string;
  week: string;
}) {
  const t = useTranslations("teacher.library");
  const { run, pending, error } = useMutation();
  const [done, setDone] = useState(false);
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending || done}
        onClick={async () => {
          const r = await run("POST", `/admin/organizations/${orgId}/bank`, {
            week,
            intentId: exerciseId,
          });
          if (r.ok) setDone(true);
        }}
      >
        <Books />
        {done ? t("proposed") : t("propose")}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}

interface Preview {
  statement: string;
  steps: string[];
  answer: string;
  parameters: string;
  /** Graine de la variante : la même, revue dans un autre format. */
  seed: number | null;
  hasFigure: boolean;
}

/** Réponse attendue lisible (le prof la voit ; l'élève jamais). */
function describeAnswer(answer: unknown): string {
  const kind = read(answer, "kind");
  if (kind === "solutions") {
    const variable = read(answer, "variable");
    const values = read(answer, "values");
    return Array.isArray(values)
      ? values.map((v) => `${String(variable)} = ${String(v)}`).join(" ; ")
      : "";
  }
  const value = read(answer, "value");
  return typeof value === "string" ? value : "";
}

/** Aperçu d'une variante, vérifiée par services/math, pour un niveau et une forme donnés. */
export function PreviewDialog({
  orgId,
  exerciseId,
  objective,
}: {
  orgId: string;
  exerciseId: string;
  objective: string;
}) {
  const t = useTranslations("teacher.preview");
  const id = useId();
  const failure = useFailureText();
  const { run, pending, error } = useMutation();
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [scaffolded, setScaffolded] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  async function generate(l = level, s = scaffolded) {
    setDetail(null);
    const result = await run(
      "POST",
      `/admin/organizations/${orgId}/exercises/${exerciseId}/preview`,
      { level: l, scaffolded: s },
      { refresh: false },
    );
    if (!result.ok) {
      setPreview(null);
      setDetail(failure(result.details));
      return;
    }
    const v = read(result.data, "variant");
    const steps = read(v, "steps");
    const parameters = read(v, "parameters");
    const statement = read(v, "statement");
    const seed = read(v, "seed");
    setPreview({
      seed: typeof seed === "number" ? seed : null,
      hasFigure: read(result.data, "figure") != null,
      statement: typeof statement === "string" ? statement : "",
      steps: Array.isArray(steps)
        ? steps.filter((x): x is string => typeof x === "string")
        : [],
      answer: describeAnswer(read(v, "answer")),
      parameters:
        typeof parameters === "object" && parameters !== null
          ? Object.entries(parameters)
              .map(([k, val]) => `${k} = ${String(val)}`)
              .join(", ")
          : "",
    });
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open && !preview) generate();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Eye />
          {t("open")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{objective}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-4">
          <ToggleGroup
            type="single"
            variant="outline"
            value={String(level)}
            aria-label={t("level")}
            onValueChange={(v) => {
              const l = v === "2" ? 2 : v === "3" ? 3 : v === "1" ? 1 : null;
              if (l) {
                setLevel(l);
                generate(l, scaffolded);
              }
            }}
          >
            {[1, 2, 3].map((l) => (
              <ToggleGroupItem key={l} value={String(l)}>
                {t("levelValue", { level: l })}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex items-center gap-2">
            <Switch
              id={`${id}-scaffold`}
              checked={scaffolded}
              onCheckedChange={(c) => {
                setScaffolded(c);
                generate(level, c);
              }}
            />
            <Label htmlFor={`${id}-scaffold`}>{t("scaffolded")}</Label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
        {pending && (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        )}
        {error && !pending && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
              {detail && <span className="block">{detail}</span>}
            </AlertDescription>
          </Alert>
        )}
        {preview && !pending && (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="font-math text-lg">{preview.statement}</p>
            {scaffolded && preview.steps.length > 0 && (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {preview.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t("answer")}</dt>
              <dd className="font-math">{preview.answer}</dd>
              <dt className="text-muted-foreground">{t("parameters")}</dt>
              <dd className="font-mono text-xs">{preview.parameters}</dd>
            </dl>
            <Button size="sm" variant="outline" onClick={() => generate()}>
              {t("another")}
            </Button>
            {preview.seed !== null && (
              <PreviewFormats
                orgId={orgId}
                exerciseId={exerciseId}
                level={level}
                scaffolded={scaffolded}
                seed={preview.seed}
                hasFigure={preview.hasFigure}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
