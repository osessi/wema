import "server-only";
import type { Permission } from "@wema/domain";
import { cache } from "react";
import { load, serverApi } from "./api-server";

/** Utilisateur connecté et permissions, lus une fois par requête. */
export const getSession = cache(async () => {
  const api = await serverApi();
  return load(api.auth.me.$get());
});

export async function hasPermission(permission: Permission): Promise<boolean> {
  return (await getSession()).permissions.includes(permission);
}
