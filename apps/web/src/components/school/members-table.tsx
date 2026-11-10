"use client";

import {
  AppleLogo,
  DotsThree,
  Envelope,
  GoogleLogo,
  IdentificationCard,
  Key,
  Phone,
  ShieldPlus,
  Users,
  X,
} from "@phosphor-icons/react";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wema/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wema/ui/components/ui/dropdown-menu";
import { toast } from "@wema/ui/components/ui/sonner";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import {
  type DataColumn,
  DataTable,
} from "@wema/ui/components/wema/data-table";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { PersonChip } from "@wema/ui/components/wema/person-avatar";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { read } from "../../lib/mutate";
import type { SchoolMember, SchoolRoles } from "../../lib/school-types";
import { useMutation } from "../../lib/use-mutation";
import { LoginCode } from "./login-code";
import { roleLook, roleTone } from "./role-style";

const LOGIN_KINDS = ["email", "phone", "username", "google", "apple"] as const;
type LoginKind = (typeof LOGIN_KINDS)[number];
const isLoginKind = (v: string): v is LoginKind =>
  LOGIN_KINDS.some((k) => k === v);

const LOGIN_ICONS: Record<LoginKind, ReactNode> = {
  email: <Envelope aria-hidden className="size-3.5" />,
  phone: <Phone aria-hidden className="size-3.5" />,
  username: <IdentificationCard aria-hidden className="size-3.5" />,
  google: <GoogleLogo aria-hidden className="size-3.5" />,
  apple: <AppleLogo aria-hidden className="size-3.5" />,
};

function RoleBadges({
  organizationId,
  member,
  roles,
  self,
}: {
  organizationId: string;
  member: SchoolMember;
  roles: SchoolRoles;
  self: boolean;
}) {
  const t = useTranslations("school.members");
  const { run, pending } = useMutation();
  const base = `/admin/organizations/${organizationId}/members/${member.userId}`;
  if (member.roles.length === 0)
    return <span className="text-sm text-muted-foreground">{t("noRole")}</span>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {member.roles.map((r) => (
        <Badge
          key={r.id}
          variant={roleTone(r.name, roles)}
          className={self ? undefined : "gap-1 pr-1"}
        >
          {roleLook(r.name, roles).icon}
          {r.name}
          {!self && (
            <ConfirmDialog
              trigger={
                <button
                  type="button"
                  className="grid size-4 place-items-center rounded-full opacity-70 transition-opacity hover:bg-background/60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label={t("removeRole", { role: r.name })}
                  disabled={pending}
                >
                  <X weight="bold" className="size-2.5" />
                </button>
              }
              variant="destructive"
              title={t("removeRoleConfirm", {
                role: r.name,
                name: member.displayName,
              })}
              description={t("removeRoleHint")}
              confirmLabel={t("removeRoleAction")}
              cancelLabel={t("cancel")}
              onConfirm={async () => {
                const result = await run("DELETE", `${base}/roles/${r.id}`);
                if (result.ok)
                  toast.success(
                    t("roleRemoved", {
                      role: r.name,
                      name: member.displayName,
                    }),
                  );
                else toast.error(t("failed"));
                return result.ok;
              }}
            />
          )}
        </Badge>
      ))}
    </div>
  );
}

function Logins({ member }: { member: SchoolMember }) {
  const t = useTranslations("school.members");
  if (member.identities.length === 0)
    return <span className="text-sm text-muted-foreground">–</span>;
  return (
    <ul className="space-y-1 text-sm">
      {member.identities.map((i) => (
        <li
          key={`${i.kind}:${i.identifier}`}
          className="flex min-w-0 items-center gap-2"
        >
          <span
            className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
            title={isLoginKind(i.kind) ? t(`loginKinds.${i.kind}`) : i.kind}
          >
            {isLoginKind(i.kind) ? LOGIN_ICONS[i.kind] : null}
            <span className="sr-only">
              {isLoginKind(i.kind) ? t(`loginKinds.${i.kind}`) : i.kind}
            </span>
          </span>
          <span className="min-w-0 truncate">
            {i.kind === "google" || i.kind === "apple"
              ? t(`loginKinds.${i.kind}`)
              : i.identifier}
          </span>
        </li>
      ))}
    </ul>
  );
}

function RowActions({
  organizationId,
  member,
  roles,
  self,
}: {
  organizationId: string;
  member: SchoolMember;
  roles: SchoolRoles;
  self: boolean;
}) {
  const t = useTranslations("school.members");
  const { run, pending } = useMutation();
  const [code, setCode] = useState<string | null>(null);
  const base = `/admin/organizations/${organizationId}/members/${member.userId}`;
  const available = self
    ? []
    : roles.filter((r) => !member.roles.some((m) => m.id === r.id));
  const username = member.identities.find((i) => i.kind === "username");
  if (available.length === 0 && !username)
    return <span className="sr-only">{t("noAction")}</span>;

  async function newCode() {
    const result = await run("POST", `${base}/login-code`, undefined, {
      refresh: false,
    });
    const value = result.ok ? read(result.data, "loginCode") : null;
    if (typeof value === "string") setCode(value);
    else toast.error(t("failed"));
  }

  async function addRole(id: string, name: string) {
    const result = await run("POST", `${base}/roles`, { roleId: id });
    if (result.ok)
      toast.success(t("roleAdded", { role: name, name: member.displayName }));
    else toast.error(t("failed"));
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon-sm"
            variant="outline"
            disabled={pending}
            aria-label={t("rowActions", { name: member.displayName })}
          >
            <DotsThree weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {available.length > 0 && (
            <>
              <DropdownMenuLabel>{t("addRole")}</DropdownMenuLabel>
              {available.map((r) => (
                <DropdownMenuItem
                  key={r.id}
                  onSelect={() => addRole(r.id, r.name)}
                >
                  <ShieldPlus aria-hidden />
                  <span className="flex-1">{r.name}</span>
                  <Badge variant={roleTone(r.name, roles)}>
                    {r.system
                      ? t("allPermissions")
                      : t("permissionCount", { count: r.permissions.length })}
                  </Badge>
                </DropdownMenuItem>
              ))}
            </>
          )}
          {available.length > 0 && username && <DropdownMenuSeparator />}
          {username && (
            <DropdownMenuItem onSelect={newCode}>
              <Key aria-hidden />
              {t("newCode")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={code !== null}
        onOpenChange={(open) => {
          if (!open) setCode(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newCode")}</DialogTitle>
            <DialogDescription>{member.displayName}</DialogDescription>
          </DialogHeader>
          {code && (
            <LoginCode
              name={member.displayName}
              username={username?.identifier}
              code={code}
            />
          )}
          <DialogFooter>
            <Button onClick={() => setCode(null)}>{t("codeNoted")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Membres de l'organisation, leurs rôles et leurs moyens de connexion. */
export function MembersTable({
  organizationId,
  members,
  roles,
  currentUserId,
}: {
  organizationId: string;
  members: SchoolMember[];
  roles: SchoolRoles;
  currentUserId: string;
}) {
  const t = useTranslations("school.members");
  const columns: DataColumn<SchoolMember>[] = [
    {
      id: "name",
      header: t("name"),
      primary: true,
      sortValue: (m) => m.displayName,
      searchValue: (m) => m.displayName,
      cell: (m) => (
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <PersonChip
            name={m.displayName}
            seed={m.userId}
            meta={m.userId === currentUserId ? t("you") : undefined}
          />
          {m.disabled && <Badge variant="danger">{t("disabled")}</Badge>}
        </span>
      ),
    },
    {
      id: "roles",
      header: t("roles"),
      sortValue: (m) => m.roles.map((r) => r.name).join(", "),
      searchValue: (m) => m.roles.map((r) => r.name).join(" "),
      cell: (m) => (
        <RoleBadges
          organizationId={organizationId}
          member={m}
          roles={roles}
          self={m.userId === currentUserId}
        />
      ),
    },
    {
      id: "logins",
      header: t("logins"),
      searchValue: (m) => m.identities.map((i) => i.identifier).join(" "),
      cell: (m) => <Logins member={m} />,
    },
    {
      id: "actions",
      header: t("actions"),
      align: "end",
      className: "w-16",
      cell: (m) => (
        <RowActions
          organizationId={organizationId}
          member={m}
          roles={roles}
          self={m.userId === currentUserId}
        />
      ),
    },
  ];
  return (
    <DataTable
      label={t("tableLabel")}
      columns={columns}
      rows={members}
      getRowId={(m) => m.userId}
      searchable={members.length > 6}
      pageSize={20}
      initialSort={{ id: "name" }}
      labels={{ searchPlaceholder: t("searchPlaceholder") }}
      empty={
        <EmptyState
          icon={<Users weight="fill" />}
          tone="sky"
          title={t("none")}
          description={t("noneHint")}
        />
      }
    />
  );
}
