"use client";

import { isPermission, PERMISSIONS, type Permission } from "@wema/domain";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  TextField,
} from "@wema/ui";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { RoleList } from "../../../../lib/types";
import { useMutation } from "../../../../lib/use-mutation";

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
    <div className="w-grid w-grid--narrow">
      {PERMISSIONS.map((p) => (
        <Checkbox
          key={p.id}
          label={t(`permissions.${p.id}`)}
          hint={
            p.scope === "platform" && !platform
              ? t("roles.platformOnly")
              : undefined
          }
          checked={selected.includes(p.id)}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              e.target.checked
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
    <Card
      title={
        <span className="w-row">
          {role.name}
          {role.system ? (
            <Badge tone="orange">{t("roles.system")}</Badge>
          ) : null}
        </span>
      }
    >
      <form className="w-stack" onSubmit={save}>
        {canManage ? (
          <TextField
            label={t("roles.name")}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        ) : null}
        <div className="w-field__label">{t("roles.permissions")}</div>
        <PermissionChecks
          selected={permissions}
          onChange={setPermissions}
          disabled={locked}
          platform={platform}
        />
        {error ? <Alert tone="error">{error}</Alert> : null}
        {saved ? <Alert tone="success">{t("common.saved")}</Alert> : null}
        {canManage ? (
          <div className="w-row">
            <Button type="submit" disabled={pending}>
              {t("common.save")}
            </Button>
            {role.system ? null : (
              <Button variant="danger" disabled={pending} onClick={remove}>
                {t("common.delete")}
              </Button>
            )}
          </div>
        ) : null}
      </form>
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
    <div className="w-stack" style={{ gap: 20 }}>
      <p className="w-muted" style={{ margin: 0 }}>
        {t("roles.hint")}
      </p>
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
        <Card title={t("roles.new")}>
          <form className="w-stack" onSubmit={create}>
            <TextField
              label={t("roles.name")}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="w-field__label">{t("roles.permissions")}</div>
            <PermissionChecks
              selected={permissions}
              onChange={setPermissions}
              disabled={false}
              platform={platform}
            />
            {error ? <Alert tone="error">{error}</Alert> : null}
            <div>
              <Button type="submit" disabled={pending}>
                {t("common.create")}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
