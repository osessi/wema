"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  SelectField,
  Table,
  TextField,
} from "@wema/ui";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { read } from "../../../../lib/mutate";
import type { MemberList, RoleList } from "../../../../lib/types";
import { useMutation } from "../../../../lib/use-mutation";

type Member = MemberList[number];
const LOGIN_KINDS = ["email", "phone", "username"] as const;
type LoginKind = (typeof LOGIN_KINDS)[number];
const isLoginKind = (value: string): value is LoginKind =>
  LOGIN_KINDS.some((k) => k === value);

/** Code de connexion à montrer une seule fois. */
function LoginCode({ name, code }: { name: string; code: string }) {
  const t = useTranslations("members");
  return (
    <Alert tone="warning">
      <strong>{t("loginCode", { name, code })}</strong>
      <div>{t("loginCodeHint")}</div>
    </Alert>
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
    <tr>
      <td>
        {member.displayName}{" "}
        {member.disabled ? (
          <Badge tone="grey">{t("members.disabled")}</Badge>
        ) : null}
      </td>
      <td>
        <div className="w-stack" style={{ gap: 6 }}>
          {member.roles.map((r) => (
            <span key={r.id} className="w-row" style={{ gap: 4 }}>
              <Badge>{r.name}</Badge>
              <Button
                size="sm"
                variant="ghost"
                aria-label={t("members.removeRole")}
                title={t("members.removeRole")}
                disabled={pending}
                onClick={() => run("DELETE", `${base}/roles/${r.id}`)}
              >
                ×
              </Button>
            </span>
          ))}
          {available.length > 0 ? (
            <span className="w-row" style={{ alignItems: "flex-end" }}>
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
                size="sm"
                variant="secondary"
                disabled={pending || !roleId}
                onClick={() => run("POST", `${base}/roles`, { roleId })}
              >
                {t("common.add")}
              </Button>
            </span>
          ) : null}
        </div>
      </td>
      <td>
        <div className="w-stack" style={{ gap: 4 }}>
          {member.identities.map((i) => (
            <span key={`${i.kind}:${i.identifier}`} className="w-small">
              <span className="w-muted">
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
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={newCode}
              >
                {t("members.newLoginCode")}
              </Button>
            </div>
          ) : null}
          {code ? <LoginCode name={member.displayName} code={code} /> : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
        </div>
      </td>
    </tr>
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
    <form className="w-stack" onSubmit={submit}>
      <div className="w-grid w-grid--narrow">
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
      <div className="w-grid w-grid--narrow">
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
      {error ? <Alert tone="error">{error}</Alert> : null}
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
    <div className="w-stack" style={{ gap: 20 }}>
      <Card title={t("title")}>
        {members.length === 0 ? (
          <EmptyState>{t("none")}</EmptyState>
        ) : (
          <Table head={[t("displayName"), t("roles"), t("identities")]}>
            {members.map((m) => (
              <MemberRow
                key={m.userId}
                organizationId={organizationId}
                member={m}
                roles={roles}
              />
            ))}
          </Table>
        )}
      </Card>
      <Card title={t("new")}>
        <AddMemberForm organizationId={organizationId} roles={roles} />
      </Card>
    </div>
  );
}
