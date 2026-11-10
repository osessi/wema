"use client";

import { Plus, X } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { read } from "../../lib/mutate";
import type { SchoolMember, SchoolRoles } from "../../lib/school-types";
import { useMutation } from "../../lib/use-mutation";
import { LoginCode } from "./login-code";

const LOGIN_KINDS = ["email", "phone", "username", "google", "apple"] as const;
type LoginKind = (typeof LOGIN_KINDS)[number];
const isLoginKind = (v: string): v is LoginKind =>
  LOGIN_KINDS.some((k) => k === v);

function MemberRow({
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
  const { run, pending, error } = useMutation();
  const [code, setCode] = useState<string | null>(null);
  const base = `/admin/organizations/${organizationId}/members/${member.userId}`;
  const available = roles.filter(
    (r) => !member.roles.some((m) => m.id === r.id),
  );
  const username = member.identities.find((i) => i.kind === "username");

  async function newCode() {
    const result = await run("POST", `${base}/login-code`, undefined, {
      refresh: false,
    });
    const value = result.ok ? read(result.data, "loginCode") : null;
    setCode(typeof value === "string" ? value : null);
  }

  return (
    <TableRow className="align-top">
      <TableCell className="font-medium whitespace-normal">
        {member.displayName}
        {self && (
          <span className="ml-2 text-xs text-muted-foreground">{t("you")}</span>
        )}
        {member.disabled && (
          <Badge variant="outline" className="ml-2">
            {t("disabled")}
          </Badge>
        )}
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="flex flex-wrap items-center gap-1.5">
          {member.roles.map((r) => (
            <Badge key={r.id} variant="secondary" className="gap-0.5 pr-1">
              {r.name}
              {!self && (
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-background"
                      aria-label={t("removeRole", { role: r.name })}
                      disabled={pending}
                    >
                      <X className="size-3" />
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
                  onConfirm={async () =>
                    (await run("DELETE", `${base}/roles/${r.id}`)).ok
                  }
                />
              )}
            </Badge>
          ))}
          {!self && available.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="outline"
                  aria-label={t("addRole")}
                  disabled={pending}
                >
                  <Plus />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>{t("addRole")}</DropdownMenuLabel>
                {available.map((r) => (
                  <DropdownMenuItem
                    key={r.id}
                    onSelect={() =>
                      run("POST", `${base}/roles`, { roleId: r.id })
                    }
                  >
                    {r.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TableCell>
      <TableCell className="whitespace-normal">
        <ul className="space-y-0.5 text-sm">
          {member.identities.map((i) => (
            <li key={`${i.kind}:${i.identifier}`}>
              <span className="text-muted-foreground">
                {isLoginKind(i.kind) ? t(`loginKinds.${i.kind}`) : i.kind}
              </span>{" "}
              {i.kind === "google" || i.kind === "apple" ? null : i.identifier}
            </li>
          ))}
        </ul>
      </TableCell>
      <TableCell className="whitespace-normal">
        {username && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={newCode}
          >
            {t("newCode")}
          </Button>
        )}
        {code && (
          <div className="mt-2">
            <LoginCode
              name={member.displayName}
              username={username?.identifier}
              code={code}
            />
          </div>
        )}
        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </TableCell>
    </TableRow>
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
  if (members.length === 0)
    return <p className="text-sm text-muted-foreground">{t("none")}</p>;
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("roles")}</TableHead>
            <TableHead>{t("logins")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <MemberRow
              key={m.userId}
              organizationId={organizationId}
              member={m}
              roles={roles}
              self={m.userId === currentUserId}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
