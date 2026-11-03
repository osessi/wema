"use client";

import {
  Bell,
  CaretUpDown,
  Moon,
  SignOut,
  Sun,
  UserCircle,
} from "@phosphor-icons/react";
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@wema/ui/components/ui/sidebar";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";
import { mutate, read } from "../../lib/mutate";
import { LegalLinks } from "../legal/legal-links";
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

/** Sur mobile, le tiroir du menu se referme quand on change de page. */
function CloseDrawerOnNavigate({ pathname }: { pathname: string }) {
  const { setOpenMobile } = useSidebar();
  // biome-ignore lint/correctness/useExhaustiveDependencies: on réagit au changement de page.
  useEffect(() => setOpenMobile(false), [pathname, setOpenMobile]);
  return null;
}

/** Messages non lus (route légère), relus à chaque changement de page. */
function useUnreadMessages(pathname: string) {
  const [count, setCount] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: on relit à chaque page.
  useEffect(() => {
    let live = true;
    fetch("/api/notifications/unread", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: unknown) => {
        const n = read(json, "messages");
        if (live && typeof n === "number") setCount(n);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pathname]);
  return count;
}

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
  const tNotif = useTranslations("notifications");
  const pathname = usePathname();
  const unread = useUnreadMessages(pathname);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  // L'entrée active est la plus précise qui contient la page : « /ecole/x »
  // ne reste pas allumée sur « /ecole/x/classes ».
  const within = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const active = nav
    .map((item) => item.href)
    .filter(within)
    .sort((a, b) => b.length - a.length)[0];
  const current = (href: string) => href === active;

  async function logout() {
    await mutate("POST", "/auth/logout");
    router.push("/connexion");
    router.refresh();
  }

  return (
    <SidebarProvider>
      <CloseDrawerOnNavigate pathname={pathname} />
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
                      {item.icon === "messages" && unread > 0 && (
                        <SidebarMenuBadge
                          aria-label={tNotif("unreadBadge", { count: unread })}
                        >
                          {unread > 99 ? "99+" : unread}
                        </SidebarMenuBadge>
                      )}
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
              <DropdownMenuItem asChild>
                <Link href="/compte">
                  <UserCircle />
                  {t("account")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/compte/notifications">
                  <Bell />
                  {tNotif("menu")}
                </Link>
              </DropdownMenuItem>
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
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <span className="font-display font-bold md:hidden">
            {tApp("name")}
          </span>
        </header>
        <div className="flex flex-1 flex-col gap-6 px-4 pb-10 md:px-8">
          {children}
        </div>
        <footer className="px-4 pb-6 md:px-8">
          <LegalLinks />
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
