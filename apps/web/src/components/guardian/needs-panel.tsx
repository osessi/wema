"use client";

import { ShieldCheck } from "@phosphor-icons/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@wema/ui/components/ui/alert";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Checkbox } from "@wema/ui/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@wema/ui/components/ui/dialog";
import { Label } from "@wema/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wema/ui/components/ui/select";
import { Switch } from "@wema/ui/components/ui/switch";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import {
  type DeclaredNeed,
  NEED_KEYS,
  type NeedKey,
} from "../../lib/guardian-types";
import { useMutation } from "../../lib/use-mutation";

const isNeedKey = (v: string): v is NeedKey => NEED_KEYS.some((k) => k === v);

/** Retrait d'un besoin : la déclaration est effacée, après confirmation. */
function RemoveNeed({
  label,
  onConfirm,
  pending,
  pendingConsent,
}: {
  label: string;
  onConfirm: () => void;
  pending: boolean;
  pendingConsent: boolean;
}) {
  const t = useTranslations("guardian.needs");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" disabled={pending}>
          {pendingConsent ? t("refuse") : t("remove")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("removeTitle", { label })}</DialogTitle>
          <DialogDescription>{t("removeText")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("keep")}</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={onConfirm}>{t("removeConfirm")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NeedRow({ base, need }: { base: string; need: DeclaredNeed }) {
  const t = useTranslations("guardian.needs");
  const { run, pending, error } = useMutation();
  const label = isNeedKey(need.need) ? t(`keys.${need.need}`) : need.label;
  const waiting = need.consent === "pending";
  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{label}</span>
        <div className="flex flex-wrap gap-2">
          <Badge variant={waiting ? "outline" : "secondary"}>
            {waiting
              ? t("consentPending")
              : need.declaredRole === "guardian"
                ? t("declaredByYou")
                : t("consentGiven")}
          </Badge>
          {!waiting && !need.active && (
            <Badge variant="outline">{t("paused")}</Badge>
          )}
        </div>
      </div>
      <p className="text-sm">
        <span className="text-muted-foreground">{t("adaptation")}</span>{" "}
        {need.adaptation}
      </p>
      {waiting && (
        <p className="text-sm text-muted-foreground">{t("pendingText")}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {waiting ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run("POST", `${base}/needs/${need.id}/consent`)}
          >
            {t("confirm")}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Switch
              id={`active-${need.id}`}
              checked={need.active}
              disabled={pending}
              onCheckedChange={(active) =>
                run("POST", `${base}/needs`, {
                  need: need.need,
                  active,
                  consent: true,
                })
              }
            />
            <Label htmlFor={`active-${need.id}`} className="font-normal">
              {t("active")}
            </Label>
          </div>
        )}
        <RemoveNeed
          label={label}
          pending={pending}
          pendingConsent={waiting}
          onConfirm={() => run("DELETE", `${base}/needs/${need.id}`)}
        />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </li>
  );
}

function DeclareForm({
  base,
  available,
}: {
  base: string;
  available: NeedKey[];
}) {
  const t = useTranslations("guardian.needs");
  const { run, pending, error } = useMutation();
  const [need, setNeed] = useState<NeedKey | "">("");
  const [consent, setConsent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!need || !consent) return;
    const result = await run("POST", `${base}/needs`, {
      need,
      active: true,
      consent: true,
    });
    if (result.ok) {
      setNeed("");
      setConsent(false);
    }
  }

  if (available.length === 0) return null;
  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border p-4">
      <h3 className="font-medium">{t("declareTitle")}</h3>
      <div className="max-w-sm space-y-2">
        <Label htmlFor="need">{t("need")}</Label>
        <Select
          value={need}
          onValueChange={(v) => {
            if (isNeedKey(v)) setNeed(v);
          }}
        >
          <SelectTrigger id="need" className="w-full">
            <SelectValue placeholder={t("needPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {available.map((k) => (
              <SelectItem key={k} value={k}>
                {t(`keys.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="consent"
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          className="mt-0.5"
        />
        <Label htmlFor="consent" className="leading-snug font-normal">
          {t("consent")}
        </Label>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending || !need || !consent}>
        {t("declare")}
      </Button>
    </form>
  );
}

/** Besoins particuliers déclarés : jamais diagnostiqués, toujours consentis. */
export function NeedsPanel({
  base,
  needs,
}: {
  base: string;
  needs: DeclaredNeed[];
}) {
  const t = useTranslations("guardian.needs");
  const declared = new Set(needs.map((n) => n.need));
  const available = NEED_KEYS.filter((k) => !declared.has(k));
  return (
    <div className="space-y-4">
      <Alert>
        <ShieldCheck aria-hidden />
        <AlertTitle>{t("reassureTitle")}</AlertTitle>
        <AlertDescription>
          <ul className="list-disc space-y-1 pl-4">
            <li>{t("reassure1")}</li>
            <li>{t("reassure2")}</li>
            <li>{t("reassure3")}</li>
            <li>{t("reassure4")}</li>
          </ul>
        </AlertDescription>
      </Alert>
      {needs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {needs.map((n) => (
            <NeedRow key={n.id} base={base} need={n} />
          ))}
        </ul>
      )}
      <DeclareForm base={base} available={available} />
    </div>
  );
}
