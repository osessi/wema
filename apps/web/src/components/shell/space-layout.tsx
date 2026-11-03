import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { getSpaces, SPACE_HREF, type SpaceKey } from "../../lib/spaces";
import { AppShell, type ShellNavItem } from "./app-shell";

/**
 * Mise en page d'un espace : vérifie que l'utilisateur y a accès, puis pose
 * la coquille avec le menu de l'espace.
 */
export async function SpaceLayout({
  space,
  nav,
  children,
}: {
  space: SpaceKey;
  nav: ShellNavItem[];
  children: ReactNode;
}) {
  const { session, keys } = await getSpaces();
  if (!keys.includes(space)) redirect("/");
  const t = await getTranslations("shell.spaces");
  return (
    <AppShell
      space={space}
      spaces={keys.map((k) => ({ key: k, href: SPACE_HREF[k], label: t(k) }))}
      nav={nav}
      userName={session.user.displayName}
    >
      {children}
    </AppShell>
  );
}
