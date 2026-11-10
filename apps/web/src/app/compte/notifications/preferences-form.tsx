"use client";

import {
  Bell,
  BellSlash,
  ChatCircleDots,
  ChatText,
  EnvelopeSimple,
  type Icon,
  MoonStars,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { GlowTile, type GlowTone } from "@wema/ui/brand";
import { Button } from "@wema/ui/components/ui/button";
import { FieldSection } from "@wema/ui/components/ui/field";
import { Label } from "@wema/ui/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@wema/ui/components/ui/native-select";
import { toast } from "@wema/ui/components/ui/sonner";
import { ChoiceCards } from "@wema/ui/components/wema/choice-cards";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { mutate } from "../../../lib/mutate";
import type {
  ChannelChoice,
  NotificationPreferences,
  NotificationSettings,
} from "./types";

const CHANNELS: ChannelChoice[] = ["app", "email", "whatsapp", "sms", "off"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

const CHANNEL_LOOK: Record<ChannelChoice, { Icon: Icon; tone: GlowTone }> = {
  app: { Icon: Bell, tone: "yellow" },
  email: { Icon: EnvelopeSimple, tone: "sky" },
  whatsapp: { Icon: WhatsappLogo, tone: "mint" },
  sms: { Icon: ChatText, tone: "amber" },
  off: { Icon: BellSlash, tone: "slate" },
};

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
  const enabled = (c: ChannelChoice) =>
    c === "app" || c === "off" || available[c];
  return (
    <ChoiceCards
      aria-label={label}
      value={value}
      onValueChange={(v) => {
        const c = CHANNELS.find((x) => x === v);
        if (c) onChange(c);
      }}
      columns={2}
      size="compact"
      options={CHANNELS.map((c) => {
        const look = CHANNEL_LOOK[c];
        return {
          value: c,
          title: t(c),
          icon: <look.Icon weight="fill" />,
          tone: look.tone,
          disabled: !enabled(c) && value !== c,
        };
      })}
    />
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
      <FieldSection
        tone="brand"
        icon={
          <GlowTile tone="yellow" size={36}>
            <Bell weight="fill" />
          </GlowTile>
        }
        title={t("nudges.title")}
        description={t(`nudges.${nudgeHelp}`)}
      >
        <ChannelPicker
          label={t("nudges.title")}
          value={prefs.nudgeChannel}
          onChange={(v) => set("nudgeChannel", v)}
          available={settings.available}
        />
      </FieldSection>

      <FieldSection
        tone="sky"
        icon={
          <GlowTile tone="sky" size={36}>
            <ChatCircleDots weight="fill" />
          </GlowTile>
        }
        title={t("messages.title")}
        description={t(`messages.${audience}`)}
      >
        <ChannelPicker
          label={t("messages.title")}
          value={prefs.messageChannel}
          onChange={(v) => set("messageChannel", v)}
          available={settings.available}
        />
      </FieldSection>

      {someUnavailable && (
        <p className="-mt-2 px-1 text-xs text-muted-foreground">
          {t(`unavailable.${audience}`)}
        </p>
      )}

      <FieldSection
        icon={
          <GlowTile tone="slate" size={36}>
            <MoonStars weight="fill" />
          </GlowTile>
        }
        title={t("quiet.title")}
        description={t(`quiet.${audience}`)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["quiet-start", "quietStart", "from"],
              ["quiet-end", "quietEnd", "to"],
            ] as const
          ).map(([id, key, label]) => (
            <div key={id} className="space-y-2">
              <Label htmlFor={id}>{t(`quiet.${label}`)}</Label>
              <NativeSelect
                id={id}
                className="w-full"
                value={String(prefs[key])}
                onChange={(e) => set(key, Number(e.target.value))}
              >
                {HOURS.map((h) => (
                  <NativeSelectOption key={h} value={h}>
                    {t("quiet.hour", { hour: h })}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ))}
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">{t("quiet.none")}</p>
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
      </FieldSection>

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
