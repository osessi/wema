"use client";

import { Tabs } from "@wema/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
  const [tab, setTab] = useState<"members" | "roles">(
    members ? "members" : "roles",
  );
  return (
    <>
      {members ? (
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "members", label: t("members") },
            { value: "roles", label: t("roles") },
          ]}
        />
      ) : null}
      {members && tab === "members" ? (
        <MembersPanel
          organizationId={organizationId}
          members={members}
          roles={roles}
        />
      ) : (
        <RolesPanel
          organizationId={organizationId}
          platform={platform}
          roles={roles}
          canManage={canManageRoles}
        />
      )}
    </>
  );
}
