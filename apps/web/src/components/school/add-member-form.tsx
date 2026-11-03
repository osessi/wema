"use client";

import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wema/ui/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@wema/ui/components/ui/tabs";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { read } from "../../lib/mutate";
import type { SchoolRoles } from "../../lib/school-types";
import { useMutation } from "../../lib/use-mutation";
import { LoginCode } from "./login-code";

const KINDS = ["email", "phone", "username"] as const;
type Kind = (typeof KINDS)[number];
const isKind = (v: string): v is Kind => KINDS.some((k) => k === v);

/**
 * Ajout d'un membre : e-mail (avec mot de passe facultatif), téléphone, ou
 * identifiant élève (le code de connexion est généré et montré une fois).
 */
export function AddMemberForm({
  organizationId,
  roles,
  defaultRoleId,
  defaultKind = "email",
}: {
  organizationId: string;
  roles: SchoolRoles;
  defaultRoleId?: string | undefined;
  defaultKind?: Kind;
}) {
  const t = useTranslations("school.addMember");
  const { run, pending, error } = useMutation();
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [displayName, setDisplayName] = useState("");
  const [roleId, setRoleId] = useState(defaultRoleId ?? roles[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [created, setCreated] = useState<{
    name: string;
    username: string;
    code: string;
  } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setCreated(null);
    setDone(null);
    const login =
      kind === "email"
        ? { kind, email, ...(password ? { password } : {}) }
        : kind === "phone"
          ? { kind, phone }
          : { kind, username };
    const result = await run(
      "POST",
      `/admin/organizations/${organizationId}/members`,
      { displayName, roleId, login },
    );
    if (!result.ok) return;
    const code = read(result.data, "loginCode");
    if (typeof code === "string")
      setCreated({ name: displayName, username, code });
    else setDone(displayName);
    setDisplayName("");
    setEmail("");
    setPassword("");
    setPhone("");
    setUsername("");
  }

  if (roles.length === 0)
    return <p className="text-sm text-muted-foreground">{t("noRoles")}</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <Tabs
        value={kind}
        onValueChange={(v) => {
          if (isKind(v)) setKind(v);
        }}
      >
        <TabsList>
          {KINDS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {t(`kinds.${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="text-sm text-muted-foreground">{t(`hints.${kind}`)}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="member-name">{t("displayName")}</Label>
          <Input
            id="member-name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-role">{t("role")}</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger id="member-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {kind === "email" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="member-email">{t("email")}</Label>
              <Input
                id="member-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-password">{t("password")}</Label>
              <Input
                id="member-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("passwordHint")}
              </p>
            </div>
          </>
        )}
        {kind === "phone" && (
          <div className="space-y-2">
            <Label htmlFor="member-phone">{t("phone")}</Label>
            <Input
              id="member-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("phonePlaceholder")}
            />
          </div>
        )}
        {kind === "username" && (
          <div className="space-y-2">
            <Label htmlFor="member-username">{t("username")}</Label>
            <Input
              id="member-username"
              required
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("usernameHint")}</p>
          </div>
        )}
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {created && (
        <LoginCode
          name={created.name}
          username={created.username}
          code={created.code}
        />
      )}
      {done && (
        <p className="text-sm text-muted-foreground" role="status">
          {t("added", { name: done })}
        </p>
      )}
      <Button type="submit" disabled={pending || !roleId}>
        {t("submit")}
      </Button>
    </form>
  );
}
