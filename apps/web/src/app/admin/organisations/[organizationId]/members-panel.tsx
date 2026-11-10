"use client";

import { XIcon } from "@phosphor-icons/react";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { read } from "../../../../lib/mutate";
import type { MemberList, RoleList } from "../../../../lib/types";
import { useMutation } from "../../../../lib/use-mutation";
import { EmptyState, Notice, SelectField, TextField } from "../../_ui/fields";

type Member = MemberList[number];
const LOGIN_KINDS = ["email", "phone", "username"] as const;
type LoginKind = (typeof LOGIN_KINDS)[number];
const isLoginKind = (value: string): value is LoginKind =>
  LOGIN_KINDS.some((k) => k === value);

/** Code de connexion à montrer une seule fois. */
function LoginCode({ name, code }: { name: string; code: string }) {
  const t = useTranslations("members");
  return (
    <Notice tone="warning">
      <strong>{t("loginCode", { name, code })}</strong>
      <div>{t("loginCodeHint")}</div>
    </Notice>
  );
}

function MemberRow({
  organizationId,
  member,
  roles,
}: {
  organizationId: string;
  member: Member;
  roles: RoleList;
}) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const available = roles.filter(
    (r) => !member.roles.some((m) => m.id === r.id),
  );
  const [roleId, setRoleId] = useState(available[0]?.id ?? "");
  const [code, setCode] = useState<string | null>(null);
  const base = `/admin/organizations/${organizationId}/members/${member.userId}`;
  const hasUsername = member.identities.some((i) => i.kind === "username");

  async function newCode() {
    const result = await run("POST", `${base}/login-code`, undefined, {
      refresh: false,
    });
    const value = result.ok ? read(result.data, "loginCode") : null;
    setCode(typeof value === "string" ? value : null);
  }

  return (
    <TableRow className="align-top">
      <TableCell>
        <span className="flex flex-wrap items-center gap-2">
          {member.displayName}
          {member.disabled ? (
            <Badge variant="outline">{t("members.disabled")}</Badge>
          ) : null}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1.5">
          {member.roles.map((r) => (
            <span key={r.id} className="flex items-center gap-1">
              <Badge variant="secondary">{r.name}</Badge>
              <ConfirmDialog
                trigger={
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={t("members.removeRole")}
                    title={t("members.removeRole")}
                    disabled={pending}
                  >
                    <XIcon />
                  </Button>
                }
                variant="destructive"
                title={t("members.removeRoleConfirm", {
                  role: r.name,
                  name: member.displayName,
                })}
                description={t("members.removeRoleHint")}
                confirmLabel={t("members.removeRoleAction")}
                cancelLabel={t("members.cancel")}
                onConfirm={async () =>
                  (await run("DELETE", `${base}/roles/${r.id}`)).ok
                }
              />
            </span>
          ))}
          {available.length > 0 ? (
            <span className="flex flex-wrap items-end gap-2">
              <SelectField
                label={t("members.addRole")}
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                {available.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </SelectField>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || !roleId}
                onClick={() => run("POST", `${base}/roles`, { roleId })}
              >
                {t("common.add")}
              </Button>
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {member.identities.map((i) => (
            <span key={`${i.kind}:${i.identifier}`} className="text-sm">
              <span className="text-muted-foreground">
                {isLoginKind(i.kind)
                  ? t(`members.loginKinds.${i.kind}`)
                  : i.kind}
              </span>{" "}
              {i.kind === "google" || i.kind === "apple" ? "" : i.identifier}
            </span>
          ))}
          {hasUsername ? (
            <div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={newCode}
              >
                {t("members.newLoginCode")}
              </Button>
            </div>
          ) : null}
          {code ? <LoginCode name={member.displayName} code={code} /> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function AddMemberForm({
  organizationId,
  roles,
}: {
  organizationId: string;
  roles: RoleList;
}) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const [values, setValues] = useState<{
    displayName: string;
    roleId: string;
    kind: LoginKind;
    email: string;
    password: string;
    phone: string;
    username: string;
  }>({
    displayName: "",
    roleId: roles[0]?.id ?? "",
    kind: "email",
    email: "",
    password: "",
    phone: "",
    username: "",
  });
  const [created, setCreated] = useState<{ name: string; code: string } | null>(
    null,
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setCreated(null);
    const login =
      values.kind === "email"
        ? {
            kind: "email",
            email: values.email,
            ...(values.password ? { password: values.password } : {}),
          }
        : values.kind === "phone"
          ? { kind: "phone", phone: values.phone }
          : { kind: "username", username: values.username };
    const result = await run(
      "POST",
      `/admin/organizations/${organizationId}/members`,
      {
        displayName: values.displayName,
        roleId: values.roleId,
        login,
      },
    );
    if (!result.ok) return;
    const code = read(result.data, "loginCode");
    if (typeof code === "string")
      setCreated({ name: values.displayName, code });
    setValues((v) => ({
      ...v,
      displayName: "",
      email: "",
      password: "",
      phone: "",
      username: "",
    }));
  }

  if (roles.length === 0) return <EmptyState>{t("roles.none")}</EmptyState>;

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("members.displayName")}
          required
          value={values.displayName}
          onChange={(e) =>
            setValues({ ...values, displayName: e.target.value })
          }
        />
        <SelectField
          label={t("members.role")}
          value={values.roleId}
          onChange={(e) => setValues({ ...values, roleId: e.target.value })}
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t("members.login")}
          hint={t(`members.loginKindsHint.${values.kind}`)}
          value={values.kind}
          onChange={(e) => {
            const kind = e.target.value;
            if (isLoginKind(kind)) setValues({ ...values, kind });
          }}
        >
          {LOGIN_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`members.loginKinds.${k}`)}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {values.kind === "email" ? (
          <>
            <TextField
              label={t("members.email")}
              type="email"
              required
              value={values.email}
              onChange={(e) => setValues({ ...values, email: e.target.value })}
            />
            <TextField
              label={t("members.password")}
              hint={t("members.passwordHint")}
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(e) =>
                setValues({ ...values, password: e.target.value })
              }
            />
          </>
        ) : null}
        {values.kind === "phone" ? (
          <TextField
            label={t("members.phone")}
            type="tel"
            required
            value={values.phone}
            onChange={(e) => setValues({ ...values, phone: e.target.value })}
          />
        ) : null}
        {values.kind === "username" ? (
          <TextField
            label={t("members.username")}
            hint={t("members.usernameHint")}
            required
            value={values.username}
            onChange={(e) => setValues({ ...values, username: e.target.value })}
          />
        ) : null}
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {created ? <LoginCode name={created.name} code={created.code} /> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {t("common.add")}
        </Button>
      </div>
    </form>
  );
}

export function MembersPanel({
  organizationId,
  members,
  roles,
}: {
  organizationId: string;
  members: MemberList;
  roles: RoleList;
}) {
  const t = useTranslations("members");
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <EmptyState>{t("none")}</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("displayName")}</TableHead>
                  <TableHead>{t("roles")}</TableHead>
                  <TableHead>{t("identities")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <MemberRow
                    // Remonté quand ses rôles changent : le choix du rôle à ajouter repart des rôles restants.
                    key={`${m.userId}:${m.roles.map((r) => r.id).join(",")}`}
                    organizationId={organizationId}
                    member={m}
                    roles={roles}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">{t("new")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AddMemberForm
            key={roles.map((r) => r.id).join(",")}
            organizationId={organizationId}
            roles={roles}
          />
        </CardContent>
      </Card>
    </div>
  );
}
