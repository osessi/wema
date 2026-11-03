"use client";

import { CaretUpDown, Moon, SignOut, Sun } from "@phosphor-icons/react";
import { Avatar, AvatarFallback } from "@wema/ui/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wema/ui/components/ui/dropdown-menu";
import { Separator } from "@wema/ui/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@wema/ui/components/ui/sidebar";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { mutate } from "../../lib/mutate";
import { NAV_ICONS, type NavIcon } from "./icons";

export interface ShellNavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

export interface ShellSpace {
  key: string;
  href: string;
  label: string;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

/**
 * Coquille commune aux espaces : menu latéral (repliable, tiroir sur mobile),
 * changement d'espace, compte et thème.
 */
export function AppShell({
  space,
  spaces,
  nav,
  userName,
  children,
}: {
  space: string;
  spaces: ShellSpace[];
  nav: ShellNavItem[];
  userName: string;
  children: ReactNode;
}) {
  const t = useTranslations("shell");
  const tApp = useTranslations("app");
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const root = spaces.find((s) => s.key === space)?.href ?? "/";
  const current = (href: string) =>
    href === root ? pathname === href : pathname.startsWith(href);

  async function logout() {
    await mutate("POST", "/auth/logout");
    router.push("/connexion");
    router.refresh();
  }

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" aria-label={t("switchSpace")}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand font-display text-base font-extrabold text-ink-on-brand">
                  W
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="font-display text-base font-bold">
                    {tApp("name")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {spaces.find((s) => s.key === space)?.label}
                  </span>
                </span>
                {spaces.length > 1 && <CaretUpDown className="ml-auto" />}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            {spaces.length > 1 && (
              <DropdownMenuContent align="start" className="min-w-56">
                <DropdownMenuLabel>{t("switchSpace")}</DropdownMenuLabel>
                {spaces.map((s) => (
                  <DropdownMenuItem key={s.key} asChild>
                    <Link href={s.href}>{s.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={current(item.href)}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" aria-label={t("account")}>
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-surface-sunk">
                    {initials(userName)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-medium">{userName}</span>
                <CaretUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="min-w-56">
              <DropdownMenuLabel>{userName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
              >
                {resolvedTheme === "dark" ? <Sun /> : <Moon />}
                {resolvedTheme === "dark" ? t("theme.light") : t("theme.dark")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={logout}>
                <SignOut />
                {t("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" aria-label={t("toggleSidebar")} />
          <Separator orientation="vertical" className="mr-2 h-4" />
        </header>
        <div className="flex flex-1 flex-col gap-6 px-4 pb-10 md:px-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
