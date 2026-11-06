"use client";

import { Button } from "@wema/ui/components/ui/button";
import { Separator } from "@wema/ui/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@wema/ui/components/ui/tabs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useMutation } from "../../lib/use-mutation";
import { Notice, SelectField, TextField } from "../admin/_ui/fields";

const MODES = ["email", "phone", "learner"] as const;
type Mode = (typeof MODES)[number];
const isMode = (value: string): value is Mode => MODES.some((m) => m === value);

export function LoginForm({
  providers,
  oauthError,
}: {
  providers: { google: boolean; apple: boolean };
  oauthError: boolean;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const { run, pending, error } = useMutation();
  const [mode, setMode] = useState<Mode>("email");
  const [codeSent, setCodeSent] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    phone: "",
    channel: "whatsapp",
    code: "",
    displayName: "",
    username: "",
    learnerCode: "",
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const done = (ok: boolean) => {
    if (ok) {
      router.push("/");
      router.refresh();
    }
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "email") {
      done(
        (
          await run(
            "POST",
            "/auth/login",
            { email: form.email, password: form.password },
            { refresh: false },
          )
        ).ok,
      );
    } else if (mode === "learner") {
      done(
        (
          await run(
            "POST",
            "/auth/learner",
            { username: form.username, code: form.learnerCode },
            { refresh: false },
          )
        ).ok,
      );
    } else if (!codeSent) {
      const result = await run(
        "POST",
        "/auth/phone/request",
        { phone: form.phone, channel: form.channel },
        { refresh: false },
      );
      setCodeSent(result.ok);
    } else {
      const body = {
        phone: form.phone,
        code: form.code,
        ...(form.displayName ? { displayName: form.displayName } : {}),
      };
      done(
        (await run("POST", "/auth/phone/verify", body, { refresh: false })).ok,
      );
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {oauthError ? <Notice tone="error">{t("oauthError")}</Notice> : null}
      <Tabs
        value={mode}
        onValueChange={(m) => {
          if (!isMode(m)) return;
          setMode(m);
          setCodeSent(false);
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          {MODES.map((m) => (
            <TabsTrigger key={m} value={m}>
              {t(`tabs.${m}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {mode === "email" ? (
          <>
            <TextField
              label={t("email")}
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={set("email")}
            />
            <TextField
              label={t("password")}
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={set("password")}
            />
          </>
        ) : null}
        {mode === "phone" ? (
          <>
            <TextField
              label={t("phone")}
              hint={t("phoneHint")}
              type="tel"
              autoComplete="tel"
              required
              disabled={codeSent}
              value={form.phone}
              onChange={set("phone")}
            />
            {!codeSent ? (
              <SelectField
                label={t("channel")}
                value={form.channel}
                onChange={set("channel")}
              >
                <option value="whatsapp">{t("channels.whatsapp")}</option>
                <option value="sms">{t("channels.sms")}</option>
              </SelectField>
            ) : (
              <>
                <Notice tone="success">{t("codeSent")}</Notice>
                <TextField
                  label={t("code")}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={form.code}
                  onChange={set("code")}
                />
                <TextField
                  label={t("displayName")}
                  value={form.displayName}
                  onChange={set("displayName")}
                />
              </>
            )}
          </>
        ) : null}
        {mode === "learner" ? (
          <>
            <TextField
              label={t("username")}
              autoComplete="username"
              required
              value={form.username}
              onChange={set("username")}
            />
            <TextField
              label={t("learnerCode")}
              hint={t("learnerHint")}
              autoComplete="current-password"
              required
              value={form.learnerCode}
              onChange={set("learnerCode")}
            />
          </>
        ) : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {mode === "phone" && !codeSent
            ? t("sendCode")
            : mode === "phone"
              ? t("verify")
              : t("login")}
        </Button>
      </form>
      {providers.google || providers.apple ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Separator className="flex-1" />
            {t("or")}
            <Separator className="flex-1" />
          </div>
          {providers.google ? (
            <Button asChild variant="outline" className="w-full">
              <a href="/api/auth/oauth/google/start">{t("google")}</a>
            </Button>
          ) : null}
          {providers.apple ? (
            <Button asChild variant="outline" className="w-full">
              <a href="/api/auth/oauth/apple/start">{t("apple")}</a>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
