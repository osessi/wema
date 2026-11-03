"use client";

import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import { Label } from "@wema/ui/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@wema/ui/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@wema/ui/components/ui/radio-group";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { mutate } from "../../../lib/mutate";
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
      className="gap-3"
    >
      {CHANNELS.map((c) => (
        <div key={c} className="flex items-center gap-3">
          <RadioGroupItem
            value={c}
            id={`${id}-${c}`}
            disabled={!enabled(c) && value !== c}
          />
          <Label
            htmlFor={`${id}-${c}`}
            className={enabled(c) ? "" : "text-muted-foreground"}
          >
            {t(c)}
          </Label>
        </div>
      ))}
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
      <Card>
        <CardHeader>
          <CardTitle>{t("nudges.title")}</CardTitle>
          <CardDescription>{t(`nudges.${nudgeHelp}`)}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChannelPicker
            label={t("nudges.title")}
            value={prefs.nudgeChannel}
            onChange={(v) => set("nudgeChannel", v)}
            available={settings.available}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("messages.title")}</CardTitle>
          <CardDescription>{t(`messages.${audience}`)}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChannelPicker
            label={t("messages.title")}
            value={prefs.messageChannel}
            onChange={(v) => set("messageChannel", v)}
            available={settings.available}
          />
        </CardContent>
      </Card>

      {someUnavailable && (
        <p className="text-sm text-muted-foreground">
          {t(`unavailable.${audience}`)}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("quiet.title")}</CardTitle>
          <CardDescription>{t(`quiet.${audience}`)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <NativeSelectOption value="">
                {t("quiet.unset")}
              </NativeSelectOption>
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
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        {saved && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("saved")}
          </p>
        )}
      </div>
    </form>
  );
}
