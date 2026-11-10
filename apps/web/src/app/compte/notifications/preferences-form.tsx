"use client";

import { Bell, ChatCircleDots, MoonStars } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { Label } from "@wema/ui/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@wema/ui/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@wema/ui/components/ui/radio-group";
import { toast } from "@wema/ui/components/ui/sonner";
import { cn } from "@wema/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { mutate } from "../../../lib/mutate";
import { Panel } from "../../admin/_ui/kit";
import type {
  ChannelChoice,
  NotificationPreferences,
  NotificationSettings,
} from "./types";

const CHANNELS: ChannelChoice[] = ["app", "email", "whatsapp", "sms", "off"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function ChannelPicker({
  value,
  onChange,
  available,
  label,
}: {
  value: ChannelChoice;
  onChange: (v: ChannelChoice) => void;
  available: NotificationSettings["available"];
  label: string;
}) {
  const t = useTranslations("notifications.channels");
  const id = useId();
  const enabled = (c: ChannelChoice) =>
    c === "app" || c === "off" || available[c];
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(v) => {
        const c = CHANNELS.find((x) => x === v);
        if (c) onChange(c);
      }}
      className="grid gap-2 sm:grid-cols-2"
    >
      {CHANNELS.map((c) => {
        const disabled = !enabled(c) && value !== c;
        return (
          <Label
            key={c}
            htmlFor={`${id}-${c}`}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg border bg-background px-3 py-2.5 font-normal transition-colors",
              value === c
                ? "border-foreground/40 bg-muted/60"
                : "hover:bg-muted/40",
              disabled && "cursor-not-allowed text-muted-foreground opacity-70",
            )}
          >
            <RadioGroupItem value={c} id={`${id}-${c}`} disabled={disabled} />
            {t(c)}
          </Label>
        );
      })}
    </RadioGroup>
  );
}

/** Préférences de notification : canal par sorte, heures calmes, fuseau. */
export function PreferencesForm({
  settings,
}: {
  settings: NotificationSettings;
}) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPreferences>(
    settings.preferences,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [zones, setZones] = useState<string[]>([]);
  const [deviceZone, setDeviceZone] = useState<string | null>(null);
  const audience = settings.audience;
  const nudgeHelp =
    audience === "learner"
      ? "learner"
      : settings.guardian
        ? "guardian"
        : "adult";

  // Liste des fuseaux et fuseau de l'appareil : seulement dans le navigateur.
  useEffect(() => {
    setZones(Intl.supportedValuesOf("timeZone"));
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setDeviceZone(device);
    // Aucun fuseau enregistré : on propose celui de l'appareil.
    setPrefs((p) => (p.timeZone ? p : { ...p, timeZone: device }));
  }, []);

  const set = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => {
    setSaved(false);
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await mutate("PUT", "/notifications", prefs);
    setPending(false);
    if (result.ok) {
      setSaved(true);
      toast.success(t("saved"));
      router.refresh();
    } else if (result.code === "unauthenticated") {
      router.push("/connexion");
    } else {
      setError(
        result.code === "invalid_preference"
          ? t("errors.invalid")
          : t("errors.generic"),
      );
    }
  }

  const someUnavailable =
    !settings.available.email ||
    !settings.available.sms ||
    !settings.available.whatsapp;
  const zoneOptions =
    prefs.timeZone && !zones.includes(prefs.timeZone)
      ? [prefs.timeZone, ...zones]
      : zones;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Panel
        icon={<Bell weight="fill" />}
        tone="yellow"
        title={t("nudges.title")}
        description={t(`nudges.${nudgeHelp}`)}
      >
        <ChannelPicker
          label={t("nudges.title")}
          value={prefs.nudgeChannel}
          onChange={(v) => set("nudgeChannel", v)}
          available={settings.available}
        />
      </Panel>

      <Panel
        icon={<ChatCircleDots weight="fill" />}
        tone="sky"
        title={t("messages.title")}
        description={t(`messages.${audience}`)}
      >
        <ChannelPicker
          label={t("messages.title")}
          value={prefs.messageChannel}
          onChange={(v) => set("messageChannel", v)}
          available={settings.available}
        />
      </Panel>

      {someUnavailable && (
        <p className="-mt-2 px-1 text-xs text-muted-foreground">
          {t(`unavailable.${audience}`)}
        </p>
      )}

      <Panel
        icon={<MoonStars weight="fill" />}
        tone="slate"
        title={t("quiet.title")}
        description={t(`quiet.${audience}`)}
        contentClassName="space-y-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="quiet-start">{t("quiet.from")}</Label>
          <NativeSelect
            id="quiet-start"
            value={String(prefs.quietStart)}
            onChange={(e) => set("quietStart", Number(e.target.value))}
          >
            {HOURS.map((h) => (
              <NativeSelectOption key={h} value={h}>
                {t("quiet.hour", { hour: h })}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Label htmlFor="quiet-end">{t("quiet.to")}</Label>
          <NativeSelect
            id="quiet-end"
            value={String(prefs.quietEnd)}
            onChange={(e) => set("quietEnd", Number(e.target.value))}
          >
            {HOURS.map((h) => (
              <NativeSelectOption key={h} value={h}>
                {t("quiet.hour", { hour: h })}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <p className="text-xs text-muted-foreground">{t("quiet.none")}</p>
        <div className="space-y-2">
          <Label htmlFor="time-zone">{t("quiet.timeZone")}</Label>
          <NativeSelect
            id="time-zone"
            className="w-full"
            value={prefs.timeZone ?? ""}
            onChange={(e) => set("timeZone", e.target.value || null)}
          >
            <NativeSelectOption value="">{t("quiet.unset")}</NativeSelectOption>
            {zoneOptions.map((z) => (
              <NativeSelectOption key={z} value={z}>
                {z}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {deviceZone && deviceZone !== prefs.timeZone && (
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => set("timeZone", deviceZone)}
            >
              {t("quiet.useDevice", { timeZone: deviceZone })}
            </Button>
          )}
        </div>
      </Panel>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {saved && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("saved")}
          </p>
        )}
        <Button type="submit" variant="brand" disabled={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
