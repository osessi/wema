"use client";

import { isPermission, PERMISSIONS, type Permission } from "@wema/domain";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { RoleList } from "../../../../lib/types";
import { useMutation } from "../../../../lib/use-mutation";
import { CheckboxField, EmptyState, Notice, TextField } from "../../_ui/fields";

type Role = RoleList[number];

function PermissionChecks({
  selected,
  onChange,
  disabled,
  platform,
}: {
  selected: readonly Permission[];
  onChange: (next: Permission[]) => void;
  disabled: boolean;
  platform: boolean;
}) {
  const t = useTranslations();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PERMISSIONS.map((p) => (
        <CheckboxField
          key={p.id}
          label={t(`permissions.${p.id}`)}
          hint={
            p.scope === "platform" && !platform
              ? t("roles.platformOnly")
              : undefined
          }
          checked={selected.includes(p.id)}
          disabled={disabled}
          onCheckedChange={(checked) =>
            onChange(
              checked
                ? [...selected, p.id]
                : selected.filter((x) => x !== p.id),
            )
          }
        />
      ))}
    </div>
  );
}

function RoleCard({
  role,
  platform,
  canManage,
}: {
  role: Role;
  platform: boolean;
  canManage: boolean;
}) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const [name, setName] = useState(role.name);
  const [permissions, setPermissions] = useState<Permission[]>(
    role.permissions.filter(isPermission),
  );
  const [saved, setSaved] = useState(false);
  const locked = !canManage || role.system;

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    setSaved(
      (await run("PATCH", `/admin/roles/${role.id}`, { name, permissions })).ok,
    );
  }

  async function remove() {
    if (!window.confirm(t("roles.confirmDelete", { name: role.name }))) return;
    await run("DELETE", `/admin/roles/${role.id}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 font-display text-lg">
          {role.name}
          {role.system ? (
            <Badge variant="outline">{t("roles.system")}</Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={save}>
          {canManage ? (
            <TextField
              label={t("roles.name")}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          ) : null}
          <div className="text-sm font-medium">{t("roles.permissions")}</div>
          <PermissionChecks
            selected={permissions}
            onChange={setPermissions}
            disabled={locked}
            platform={platform}
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
          {saved ? <Notice tone="success">{t("common.saved")}</Notice> : null}
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={pending}>
                {t("common.save")}
              </Button>
              {role.system ? null : (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={remove}
                >
                  {t("common.delete")}
                </Button>
              )}
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

export function RolesPanel({
  organizationId,
  platform,
  roles,
  canManage,
}: {
  organizationId: string;
  platform: boolean;
  roles: RoleList;
  canManage: boolean;
}) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const result = await run(
      "POST",
      `/admin/organizations/${organizationId}/roles`,
      { name, permissions },
    );
    if (result.ok) {
      setName("");
      setPermissions([]);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground">{t("roles.hint")}</p>
      {roles.length === 0 ? (
        <EmptyState>{t("roles.none")}</EmptyState>
      ) : (
        roles.map((r) => (
          // La clé inclut les permissions : la carte repart des données relues après une écriture.
          <RoleCard
            key={`${r.id}:${r.name}:${r.permissions.join(",")}`}
            role={r}
            platform={platform}
            canManage={canManage}
          />
        ))
      )}
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">
              {t("roles.new")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={create}>
              <TextField
                label={t("roles.name")}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="text-sm font-medium">
                {t("roles.permissions")}
              </div>
              <PermissionChecks
                selected={permissions}
                onChange={setPermissions}
                disabled={false}
                platform={platform}
              />
              {error ? <Notice tone="error">{error}</Notice> : null}
              <div>
                <Button type="submit" disabled={pending}>
                  {t("common.create")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
