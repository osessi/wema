"use client";

import {
  DotsThree,
  LockSimple,
  PencilSimple,
  Plus,
  ShieldCheck,
  Trash,
} from "@phosphor-icons/react";
import { isPermission, PERMISSIONS, type Permission } from "@wema/domain";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Checkbox } from "@wema/ui/components/ui/checkbox";
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
  DropdownMenuTrigger,
} from "@wema/ui/components/ui/dropdown-menu";
import { toast } from "@wema/ui/components/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { useTranslations } from "next-intl";
import { type FormEvent, Fragment, useState } from "react";
import type { RoleList } from "../../../../lib/types";
import { useMutation } from "../../../../lib/use-mutation";
import { CheckboxField, Notice, TextField } from "../../_ui/fields";
import { Panel } from "../../_ui/kit";

type Role = RoleList[number];

const ORG_PERMISSIONS = PERMISSIONS.filter((p) => p.scope === "organization");
const PLATFORM_PERMISSIONS = PERMISSIONS.filter((p) => p.scope === "platform");

const permissionsOf = (role: Role): Permission[] =>
  role.permissions.filter(isPermission);

/** Dialogue de création d'un rôle : nom et permissions. */
function NewRoleDialog({
  organizationId,
  platform,
}: {
  organizationId: string;
  platform: boolean;
}) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const shown = platform ? PERMISSIONS : ORG_PERMISSIONS;

  async function create(e: FormEvent) {
    e.preventDefault();
    const result = await run(
      "POST",
      `/admin/organizations/${organizationId}/roles`,
      { name, permissions },
    );
    if (result.ok) {
      toast.success(t("roles.created", { name }));
      setName("");
      setPermissions([]);
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden weight="bold" />
          {t("roles.new")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("roles.new")}</DialogTitle>
          <DialogDescription>{t("roles.hint")}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={create}>
          <TextField
            label={t("roles.name")}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <fieldset className="grid gap-3">
            <legend className="mb-3 text-sm font-medium">
              {t("roles.permissions")}
            </legend>
            <div className="grid max-h-[50vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {shown.map((p) => (
                <CheckboxField
                  key={p.id}
                  label={t(`permissions.${p.id}`)}
                  checked={permissions.includes(p.id)}
                  onCheckedChange={(checked) =>
                    setPermissions((prev) =>
                      checked
                        ? [...prev, p.id]
                        : prev.filter((x) => x !== p.id),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {t("common.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Menu d'un rôle personnalisé : renommer, supprimer. */
function RoleMenu({ role, name }: { role: Role; name: string }) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [value, setValue] = useState(role.name);

  async function rename(e: FormEvent) {
    e.preventDefault();
    const result = await run("PATCH", `/admin/roles/${role.id}`, {
      name: value,
      permissions: permissionsOf(role),
    });
    if (result.ok) {
      toast.success(t("common.saved"));
      setRenaming(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={t("roles.menu", { name })}
          >
            <DotsThree weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <PencilSimple aria-hidden />
            {t("roles.rename")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleting(true)}
          >
            <Trash aria-hidden />
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("roles.rename")}</DialogTitle>
          </DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={rename}>
            <TextField
              label={t("roles.name")}
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {error ? <Notice tone="error">{error}</Notice> : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenaming(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {t("common.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        variant="destructive"
        title={t("roles.confirmDelete", { name: role.name })}
        description={t("roles.deleteHint")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        error={error ?? undefined}
        onConfirm={async () => {
          const ok = (await run("DELETE", `/admin/roles/${role.id}`)).ok;
          if (ok) toast.success(t("roles.deleted", { name: role.name }));
          return ok;
        }}
      />
    </>
  );
}

/**
 * Matrice permissions × rôles. Les cases modifiées s'enregistrent ensemble,
 * depuis la barre qui n'apparaît que s'il y a des changements.
 */
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
  const initial = () =>
    Object.fromEntries(roles.map((r) => [r.id, permissionsOf(r)]));
  const [draft, setDraft] = useState<Record<string, Permission[]>>(initial);

  const dirty = roles.filter((r) => {
    const now = draft[r.id] ?? [];
    const was = permissionsOf(r);
    return now.length !== was.length || now.some((p) => !was.includes(p));
  });

  // Hors de Wema, les permissions plateforme sont repliées, sauf si un rôle en a déjà.
  const platformShown =
    platform ||
    roles.some((r) =>
      PLATFORM_PERMISSIONS.some((p) => (draft[r.id] ?? []).includes(p.id)),
    );
  const groups = [
    {
      key: "organization",
      label: t("roles.groupOrganization"),
      items: ORG_PERMISSIONS,
    },
    ...(platformShown
      ? [
          {
            key: "platform",
            label: platform
              ? t("roles.groupPlatform")
              : t("roles.groupPlatformElsewhere"),
            items: PLATFORM_PERMISSIONS,
          },
        ]
      : []),
  ];

  const toggle = (roleId: string, permission: Permission, on: boolean) =>
    setDraft((prev) => {
      const list = prev[roleId] ?? [];
      return {
        ...prev,
        [roleId]: on
          ? [...list, permission]
          : list.filter((p) => p !== permission),
      };
    });

  async function saveAll() {
    for (const r of dirty) {
      const result = await run("PATCH", `/admin/roles/${r.id}`, {
        name: r.name,
        permissions: draft[r.id] ?? [],
      });
      if (!result.ok) return;
    }
    toast.success(t("roles.savedCount", { count: dirty.length }));
  }

  return (
    <Panel
      icon={<ShieldCheck weight="fill" />}
      tone="sky"
      title={t("roles.title")}
      description={t("roles.hint")}
      actions={
        canManage ? (
          <NewRoleDialog organizationId={organizationId} platform={platform} />
        ) : undefined
      }
      flush={roles.length > 0}
    >
      {roles.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<ShieldCheck weight="fill" />}
          tone="sky"
          title={t("roles.none")}
          titleAs="p"
        />
      ) : (
        <>
          <Table style={{ minWidth: `${200 + roles.length * 104}px` }}>
            <caption className="sr-only">{t("roles.matrixCaption")}</caption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-10 bg-card">
                  {t("roles.permissions")}
                </TableHead>
                {roles.map((r) => (
                  <TableHead
                    key={r.id}
                    className="w-28 text-center"
                    scope="col"
                  >
                    <span className="inline-flex items-center gap-1 normal-case">
                      <span className="font-sans text-[13px] font-semibold tracking-normal text-foreground">
                        {r.name}
                      </span>
                      {r.system ? (
                        <LockSimple
                          aria-label={t("roles.systemShort")}
                          className="size-3.5 text-muted-foreground"
                          weight="bold"
                        />
                      ) : canManage ? (
                        <RoleMenu role={r} name={r.name} />
                      ) : null}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <Fragment key={g.key}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell
                      colSpan={roles.length + 1}
                      className="py-2 font-mono text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
                    >
                      {g.label}
                    </TableCell>
                  </TableRow>
                  {g.items.map((p) => (
                    <TableRow key={p.id}>
                      <TableHead
                        scope="row"
                        className="sticky left-0 z-10 h-auto min-w-[180px] bg-card py-2.5 font-sans text-sm font-normal tracking-normal whitespace-normal text-foreground normal-case"
                      >
                        {t(`permissions.${p.id}`)}
                      </TableHead>
                      {roles.map((r) => {
                        const checked = (draft[r.id] ?? []).includes(p.id);
                        const locked = !canManage || r.system;
                        return (
                          <TableCell key={r.id} className="text-center">
                            <Checkbox
                              aria-label={`${t(`permissions.${p.id}`)} · ${r.name}`}
                              checked={checked}
                              disabled={locked || pending}
                              onCheckedChange={(v) =>
                                toggle(r.id, p.id, v === true)
                              }
                              className="translate-y-0.5"
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
          {roles.some((r) => r.system) ? (
            <p className="flex items-center gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              <LockSimple aria-hidden className="size-3.5" weight="bold" />
              {t("roles.system")}
            </p>
          ) : null}
          {error ? (
            <div className="px-4 pb-4 sm:px-6">
              <Notice tone="error">{error}</Notice>
            </div>
          ) : null}
          {dirty.length > 0 ? (
            <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-b-card border-t bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
              <span className="flex items-center gap-2 text-sm">
                <Badge variant="warning" className="tabular-nums">
                  {dirty.length}
                </Badge>
                {t("roles.unsaved", { count: dirty.length })}
              </span>
              <span className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setDraft(initial())}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  disabled={pending}
                  onClick={saveAll}
                >
                  {t("common.save")}
                </Button>
              </span>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}
