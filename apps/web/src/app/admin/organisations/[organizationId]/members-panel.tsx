"use client";

import {
  DotsThree,
  EnvelopeSimple,
  IdentificationBadge,
  Key,
  Phone,
  Plus,
  UserPlus,
  UsersThree,
  XIcon,
} from "@phosphor-icons/react";
import type { GlowTone } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@wema/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wema/ui/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { ChoiceCards } from "@wema/ui/components/wema/choice-cards";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { PersonChip } from "@wema/ui/components/wema/person-avatar";
import { useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { read } from "../../../../lib/mutate";
import type { MemberList, RoleList } from "../../../../lib/types";
import { useMutation } from "../../../../lib/use-mutation";
import { Notice, SelectField, TextField } from "../../_ui/fields";
import { Panel } from "../../_ui/kit";

type Member = MemberList[number];
const LOGIN_KINDS = ["email", "phone", "username"] as const;
type LoginKind = (typeof LOGIN_KINDS)[number];
const isLoginKind = (value: string): value is LoginKind =>
  LOGIN_KINDS.some((k) => k === value);
const LOGIN_ICON: Record<LoginKind, ReactNode> = {
  email: <EnvelopeSimple weight="fill" />,
  phone: <Phone weight="fill" />,
  username: <IdentificationBadge weight="fill" />,
};
const LOGIN_TONE: Record<LoginKind, GlowTone> = {
  email: "sky",
  phone: "mint",
  username: "yellow",
};

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
    <TableRow>
      <TableCell>
        <span className="flex flex-wrap items-center gap-2">
          <PersonChip name={member.displayName} seed={member.userId} />
          {member.disabled ? (
            <Badge variant="danger">{t("members.disabled")}</Badge>
          ) : null}
        </span>
      </TableCell>
      <TableCell className="whitespace-normal">
        <span className="flex flex-wrap items-center gap-1.5">
          {member.roles.map((r) => (
            <Badge key={r.id} variant="info" className="gap-0.5 pr-1">
              {r.name}
              <ConfirmDialog
                trigger={
                  <button
                    type="button"
                    aria-label={`${t("members.removeRole")} : ${r.name}`}
                    title={t("members.removeRole")}
                    disabled={pending}
                    className="grid size-4 place-items-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <XIcon aria-hidden className="size-2.5" weight="bold" />
                  </button>
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
            </Badge>
          ))}
        </span>
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="flex flex-col gap-1">
          {member.identities.map((i) => (
            <span
              key={`${i.kind}:${i.identifier}`}
              className="flex flex-wrap items-baseline gap-x-2 text-sm"
            >
              <span className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
                {isLoginKind(i.kind)
                  ? t(`members.loginKindsShort.${i.kind}`)
                  : i.kind}
              </span>
              <span className="break-all">
                {i.kind === "google" || i.kind === "apple" ? "" : i.identifier}
              </span>
            </span>
          ))}
          {code ? <LoginCode name={member.displayName} code={code} /> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      </TableCell>
      <TableCell className="text-right">
        {available.length > 0 || hasUsername ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={t("members.actions", { name: member.displayName })}
                disabled={pending}
              >
                <DotsThree weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              {available.length > 0 ? (
                <>
                  <DropdownMenuLabel className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
                    {t("members.addRole")}
                  </DropdownMenuLabel>
                  {available.map((r) => (
                    <DropdownMenuItem
                      key={r.id}
                      onSelect={() =>
                        run("POST", `${base}/roles`, { roleId: r.id })
                      }
                    >
                      <Plus aria-hidden />
                      {r.name}
                    </DropdownMenuItem>
                  ))}
                </>
              ) : null}
              {available.length > 0 && hasUsername ? (
                <DropdownMenuSeparator />
              ) : null}
              {hasUsername ? (
                <DropdownMenuItem onSelect={newCode}>
                  <Key aria-hidden />
                  {t("members.newLoginCode")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
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
  const loginId = useId();
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

  if (roles.length === 0)
    return <EmptyState variant="inline" title={t("roles.none")} titleAs="p" />;

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
      </div>
      <div className="flex flex-col gap-2">
        <p id={loginId} className="text-sm font-medium">
          {t("members.login")}
        </p>
        <ChoiceCards
          aria-labelledby={loginId}
          columns={3}
          size="compact"
          value={values.kind}
          onValueChange={(kind) => {
            if (isLoginKind(kind)) setValues({ ...values, kind });
          }}
          options={LOGIN_KINDS.map((k) => ({
            value: k,
            title: t(`members.loginKinds.${k}`),
            icon: LOGIN_ICON[k],
            tone: LOGIN_TONE[k],
          }))}
        />
        <p className="text-sm text-muted-foreground">
          {t(`members.loginKindsHint.${values.kind}`)}
        </p>
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
      <div className="flex justify-end">
        <Button type="submit" variant="brand" disabled={pending}>
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
  const addMember = (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden weight="bold" />
          {t("new")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("new")}</DialogTitle>
          <DialogDescription>{t("newHint")}</DialogDescription>
        </DialogHeader>
        <AddMemberForm
          key={roles.map((r) => r.id).join(",")}
          organizationId={organizationId}
          roles={roles}
        />
      </DialogContent>
    </Dialog>
  );
  return (
    <Panel
      icon={<UsersThree weight="fill" />}
      tone="mint"
      title={
        <span className="flex items-center gap-2">
          {t("title")}
          <Badge variant="neutral" className="tabular-nums">
            {members.length}
          </Badge>
        </span>
      }
      actions={addMember}
      flush={members.length > 0}
    >
      {members.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<UsersThree weight="fill" />}
          tone="mint"
          title={t("none")}
          titleAs="p"
        />
      ) : (
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("displayName")}</TableHead>
              <TableHead>{t("roles")}</TableHead>
              <TableHead>{t("identities")}</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">{t("actionsHead")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <MemberRow
                key={`${m.userId}:${m.roles.map((r) => r.id).join(",")}`}
                organizationId={organizationId}
                member={m}
                roles={roles}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
