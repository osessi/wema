"use client";

import { Check, FirstAidKit, Minus, Plus } from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/components/brand/glow-tile";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { CardShell } from "@wema/ui/components/ui/card";
import { Checkbox } from "@wema/ui/components/ui/checkbox";
import { FieldSection } from "@wema/ui/components/ui/field";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import { toast } from "@wema/ui/components/ui/sonner";
import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import { type FormEvent, Fragment, useState } from "react";
import {
  ORGANIZATION_PERMISSIONS,
  type OrganizationPermission,
  type SchoolRoles,
} from "../../lib/school-types";
import { useMutation } from "../../lib/use-mutation";
import { roleLook } from "./role-style";

/** Permissions regroupées par domaine, pour la matrice et le formulaire. */
const DOMAINS = [
  { id: "curriculum", permissions: ["curriculum.read"] },
  { id: "exercises", permissions: ["exercises.read", "exercises.write"] },
  { id: "learners", permissions: ["learners.read", "learners.write"] },
  {
    id: "health",
    permissions: ["learners.health.read", "learners.health.write"],
  },
  {
    id: "admin",
    permissions: [
      "classes.manage",
      "members.manage",
      "roles.manage",
      "audit.read",
    ],
  },
] as const satisfies readonly {
  id: string;
  permissions: readonly OrganizationPermission[];
}[];

const isHealth = (p: OrganizationPermission) => p.startsWith("learners.health");

/** Rôles de l'organisation ; création d'un rôle avec des permissions qu'on détient soi-même. */
export function RolesPanel({
  organizationId,
  roles,
  ownPermissions,
  canManage,
  memberCounts,
}: {
  organizationId: string;
  roles: SchoolRoles;
  ownPermissions: string[];
  canManage: boolean;
  /** Nombre de membres par identifiant de rôle. */
  memberCounts?: Record<string, number> | undefined;
}) {
  const t = useTranslations("school.roles");
  const tp = useTranslations("school.permissions");
  const { run, pending, error } = useMutation();
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<Set<OrganizationPermission>>(new Set());
  const grantable = new Set(
    ORGANIZATION_PERMISSIONS.filter((p) => ownPermissions.includes(p)),
  );
  const holds = (role: SchoolRoles[number], p: OrganizationPermission) =>
    role.system || role.permissions.some((x) => x === p);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await run(
      "POST",
      `/admin/organizations/${organizationId}/roles`,
      { name, permissions: [...chosen] },
    );
    if (result.ok) {
      toast.success(t("created", { name }));
      setName("");
      setChosen(new Set());
    }
  }

  return (
    <div className="space-y-6">
      <CardShell>
        <div className="relative max-w-full overflow-x-auto overscroll-x-contain rounded-card border bg-card">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
            <caption className="sr-only">{t("matrix")}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 border-b bg-card px-4 py-3 text-left align-bottom font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
                >
                  {t("permissions")}
                </th>
                {roles.map((r) => (
                  <th
                    key={r.id}
                    scope="col"
                    className="border-b px-3 py-3 text-center align-bottom font-medium"
                  >
                    <Badge variant={roleLook(r.name, roles).tone}>
                      {roleLook(r.name, roles).icon}
                      {r.name}
                    </Badge>
                    {memberCounts && (
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground tabular-nums">
                        {t("members", { count: memberCounts[r.id] ?? 0 })}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DOMAINS.map((d) => (
                <Fragment key={d.id}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={roles.length + 1}
                      className="border-b bg-muted/50 px-4 py-1.5 text-left font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
                    >
                      {t(`domains.${d.id}`)}
                    </th>
                  </tr>
                  {d.permissions.map((p) => (
                    <tr key={p} className="hover:bg-muted/40">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-b bg-card px-4 py-2.5 text-left font-normal"
                      >
                        <span className="flex items-center gap-2">
                          {tp(p)}
                          {isHealth(p) && (
                            <Badge variant="warning">
                              <FirstAidKit weight="fill" />
                              {t("sensitive")}
                            </Badge>
                          )}
                        </span>
                      </th>
                      {roles.map((r) => (
                        <td
                          key={r.id}
                          className="border-b px-3 py-2.5 text-center"
                        >
                          {holds(r, p) ? (
                            <span className="mx-auto grid size-6 place-items-center rounded-full bg-success-soft text-success-text">
                              <Check weight="bold" className="size-3.5" />
                              <span className="sr-only">{t("granted")}</span>
                            </span>
                          ) : (
                            <span className="mx-auto grid size-6 place-items-center text-muted-foreground/50">
                              <Minus className="size-3.5" />
                              <span className="sr-only">{t("notGranted")}</span>
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </CardShell>
      {canManage && (
        <FieldSection
          tone="neutral"
          title={<h3 className="text-base font-semibold">{t("new")}</h3>}
          icon={
            <GlowTile tone="slate" size={36}>
              <Plus weight="bold" />
            </GlowTile>
          }
        >
          <form onSubmit={submit} className="space-y-5">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="role-name">{t("name")}</Label>
              <Input
                id="role-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <fieldset className="space-y-3">
              <legend className="mb-3 text-sm font-medium">
                {t("permissions")}
              </legend>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {DOMAINS.map((d) => {
                  const items = d.permissions.filter((p) => grantable.has(p));
                  if (items.length === 0) return null;
                  return (
                    <div
                      key={d.id}
                      className={cn(
                        "space-y-2.5 rounded-lg border bg-muted/40 p-3",
                        d.id === "health" &&
                          "border-warning-text/30 bg-warning-soft/40",
                      )}
                    >
                      <p className="font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                        {t(`domains.${d.id}`)}
                      </p>
                      {items.map((p) => (
                        <div key={p} className="flex items-center gap-2">
                          <Checkbox
                            id={`perm-${p}`}
                            checked={chosen.has(p)}
                            onCheckedChange={(v) => {
                              const next = new Set(chosen);
                              if (v === true) next.add(p);
                              else next.delete(p);
                              setChosen(next);
                            }}
                          />
                          <Label htmlFor={`perm-${p}`} className="font-normal">
                            {tp(p)}
                          </Label>
                        </div>
                      ))}
                      {d.id === "health" && (
                        <p className="text-xs text-warning-text">
                          {t("healthWarning")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={pending || !name}>
              {t("create")}
            </Button>
          </form>
        </FieldSection>
      )}
    </div>
  );
}
