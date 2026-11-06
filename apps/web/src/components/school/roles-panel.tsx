"use client";

import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Checkbox } from "@wema/ui/components/ui/checkbox";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import {
  ORGANIZATION_PERMISSIONS,
  type OrganizationPermission,
  type SchoolRoles,
} from "../../lib/school-types";
import { useMutation } from "../../lib/use-mutation";

const isOrgPermission = (p: string): p is OrganizationPermission =>
  ORGANIZATION_PERMISSIONS.some((x) => x === p);

/** Rôles de l'organisation ; création d'un rôle avec des permissions qu'on détient soi-même. */
export function RolesPanel({
  organizationId,
  roles,
  ownPermissions,
  canManage,
}: {
  organizationId: string;
  roles: SchoolRoles;
  ownPermissions: string[];
  canManage: boolean;
}) {
  const t = useTranslations("school.roles");
  const tp = useTranslations("school.permissions");
  const { run, pending, error } = useMutation();
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<Set<OrganizationPermission>>(new Set());
  const grantable = ORGANIZATION_PERMISSIONS.filter((p) =>
    ownPermissions.includes(p),
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await run(
      "POST",
      `/admin/organizations/${organizationId}/roles`,
      { name, permissions: [...chosen] },
    );
    if (result.ok) {
      setName("");
      setChosen(new Set());
    }
  }

  return (
    <div className="space-y-5">
      <ul className="divide-y rounded-lg border">
        {roles.map((r) => (
          <li key={r.id} className="space-y-2 p-4">
            <p className="font-medium">{r.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {r.system ? (
                <Badge variant="outline">{t("system")}</Badge>
              ) : r.permissions.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  {t("noPermission")}
                </span>
              ) : (
                r.permissions.map((p) => (
                  <Badge key={p} variant="secondary">
                    {isOrgPermission(p) ? tp(p) : p}
                  </Badge>
                ))
              )}
            </div>
          </li>
        ))}
      </ul>
      {canManage && (
        <form onSubmit={submit} className="space-y-4 rounded-lg border p-4">
          <h3 className="font-medium">{t("new")}</h3>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="role-name">{t("name")}</Label>
            <Input
              id="role-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("permissions")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {grantable.map((p) => (
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
            </div>
          </fieldset>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" variant="outline" disabled={pending || !name}>
            {t("create")}
          </Button>
        </form>
      )}
    </div>
  );
}
