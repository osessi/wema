"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@wema/ui/components/ui/tabs";
import { useTranslations } from "next-intl";
import type { MemberList, RoleList } from "../../../../lib/types";
import { MembersPanel } from "./members-panel";
import { RolesPanel } from "./roles-panel";

export function OrganizationTabs({
  organizationId,
  platform,
  roles,
  members,
  canManageRoles,
}: {
  organizationId: string;
  platform: boolean;
  roles: RoleList;
  /** `null` : pas le droit de voir les membres. */
  members: MemberList | null;
  canManageRoles: boolean;
}) {
  const t = useTranslations("organizations.tabs");
  const rolesPanel = (
    <RolesPanel
      // Repart des données relues après un enregistrement.
      key={roles
        .map((r) => `${r.id}:${r.name}:${r.permissions.join(",")}`)
        .join("|")}
      organizationId={organizationId}
      platform={platform}
      roles={roles}
      canManage={canManageRoles}
    />
  );
  if (!members) return rolesPanel;
  return (
    <Tabs defaultValue="members" className="gap-4">
      <TabsList variant="line">
        <TabsTrigger value="members">{t("members")}</TabsTrigger>
        <TabsTrigger value="roles">{t("roles")}</TabsTrigger>
      </TabsList>
      <TabsContent value="members">
        <MembersPanel
          organizationId={organizationId}
          members={members}
          roles={roles}
        />
      </TabsContent>
      <TabsContent value="roles">{rolesPanel}</TabsContent>
    </Tabs>
  );
}
