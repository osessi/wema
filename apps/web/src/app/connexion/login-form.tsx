"use client";

import { Alert, Button, SelectField, Tabs, TextField } from "@wema/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useMutation } from "../../lib/use-mutation";

type Mode = "email" | "phone" | "learner";

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
    <div className="w-stack">
      {oauthError ? <Alert tone="error">{t("oauthError")}</Alert> : null}
      <Tabs
        value={mode}
        onChange={(m) => {
          setMode(m);
          setCodeSent(false);
        }}
        tabs={[
          { value: "email", label: t("tabs.email") },
          { value: "phone", label: t("tabs.phone") },
          { value: "learner", label: t("tabs.learner") },
        ]}
      />
      <form className="w-stack" onSubmit={submit}>
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
                <Alert tone="success">{t("codeSent")}</Alert>
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
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="submit" block disabled={pending}>
          {mode === "phone" && !codeSent
            ? t("sendCode")
            : mode === "phone"
              ? t("verify")
              : t("login")}
        </Button>
      </form>
      {providers.google || providers.apple ? (
        <div className="w-stack">
          <div className="w-muted w-small" style={{ textAlign: "center" }}>
            {t("or")}
          </div>
          {providers.google ? (
            <a
              className="w-btn w-btn--secondary w-btn--block"
              href="/api/auth/oauth/google/start"
            >
              {t("google")}
            </a>
          ) : null}
          {providers.apple ? (
            <a
              className="w-btn w-btn--secondary w-btn--block"
              href="/api/auth/oauth/apple/start"
            >
              {t("apple")}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
