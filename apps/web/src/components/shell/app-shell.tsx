"use client";

import {
  Bell,
  CaretUpDown,
  Check,
  Moon,
  SignOut,
  Sun,
  UserCircle,
} from "@phosphor-icons/react";
import {
  ActiveMarker,
  ActiveMarkerGroup,
  type AnimatedIconHandle,
  BellIcon,
  GlowTile,
} from "@wema/ui/brand";
import { Avatar, AvatarFallback } from "@wema/ui/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@wema/ui/components/ui/breadcrumb";
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
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@wema/ui/components/ui/sidebar";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { mutate, read } from "../../lib/mutate";
import { LegalLinks } from "../legal/legal-links";
import {
  NAV_GROUP,
  NAV_ICONS,
  NAV_TONES,
  type NavIcon,
  SPACE_STYLE,
} from "./icons";
import { MobileTabBar } from "./mobile-tab-bar";
import { ShellContext } from "./shell-context";

export interface ShellNavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Éléments en attente (pastille du menu), lus côté serveur. */
  count?: number;
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

/**
 * Messages non lus, relus à chaque page. `stop()` abandonne la lecture en
 * cours : à la déconnexion, elle reviendrait en 401 (session déjà fermée).
 */
function useUnreadMessages(pathname: string) {
  const [count, setCount] = useState(0);
  const pending = useRef<AbortController | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: on relit à chaque page.
  useEffect(() => {
    const controller = new AbortController();
    pending.current = controller;
    fetch("/api/notifications/unread", {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: unknown) => {
        const n = read(json, "messages");
        if (!controller.signal.aborted && typeof n === "number") setCount(n);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [pathname]);
  return { count, stop: () => pending.current?.abort() };
}

/** Pastille « W » de la marque (carré jaune, comme le site). */
function WemaMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md bg-brand text-base font-bold tracking-tight text-ink-on-brand shadow-xs",
        className,
      )}
    >
      W
    </span>
  );
}

/** Entrée du menu : pastille lumineuse, libellé, fond actif qui glisse. */
function NavEntry({
  item,
  active,
  page,
  badge,
}: {
  item: ShellNavItem;
  active: boolean;
  page: boolean;
  badge?: ReactNode;
}) {
  const Icon = NAV_ICONS[item.icon];
  const gesture = useRef<AnimatedIconHandle>(null);
  const start = () => gesture.current?.start();
  const stop = () => gesture.current?.stop();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className="relative gap-2.5 px-2 text-sidebar-foreground transition-colors data-[active=true]:bg-transparent data-[active=true]:font-medium data-[active=true]:text-foreground"
      >
        <Link
          href={item.href}
          aria-current={page ? "page" : undefined}
          onPointerEnter={start}
          onPointerLeave={stop}
          onFocus={start}
          onBlur={stop}
        >
          {active && (
            <ActiveMarker
              layoutId="shell-nav-active"
              className="inset-0 rounded-md bg-surface shadow-xs ring-1 ring-sidebar-border before:absolute before:top-2.5 before:bottom-2.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-brand"
            />
          )}
          <GlowTile
            tone={NAV_TONES[item.icon]}
            size={24}
            glyph="64%"
            lit={active}
          >
            <Icon ref={gesture} size={15} className="pointer-events-none" />
          </GlowTile>
          <span className="relative">{item.label}</span>
        </Link>
      </SidebarMenuButton>
      {badge}
    </SidebarMenuItem>
  );
}

/** Ligne du sélecteur d'espace : pastille de l'espace, libellé, coche. */
function SpaceRow({ space, current }: { space: ShellSpace; current: boolean }) {
  const style = SPACE_STYLE[space.key] ?? SPACE_STYLE.admin;
  const gesture = useRef<AnimatedIconHandle>(null);
  if (!style) return null;
  const Icon = style.icon;
  return (
    <DropdownMenuItem
      asChild
      className="gap-2.5 py-1.5"
      onPointerEnter={() => gesture.current?.start()}
      onPointerLeave={() => gesture.current?.stop()}
    >
      <Link href={space.href} aria-current={current ? "true" : undefined}>
        <GlowTile tone={style.tone} size={24} glyph="64%" lit={current}>
          <Icon ref={gesture} size={15} className="pointer-events-none" />
        </GlowTile>
        <span className="flex-1">{space.label}</span>
        {current && <Check aria-hidden="true" className="text-foreground" />}
      </Link>
    </DropdownMenuItem>
  );
}

/** Pastille de l'espace en tête du fil d'Ariane. */
function CrumbSpaceIcon({ spaceKey }: { spaceKey: string }) {
  const style = SPACE_STYLE[spaceKey] ?? SPACE_STYLE.admin;
  if (!style) return null;
  const Icon = style.icon;
  return (
    <GlowTile tone={style.tone} size={22} glyph="64%">
      <Icon size={13} className="pointer-events-none" />
    </GlowTile>
  );
}

/** Cloche de l'en-tête : mène aux messages de l'espace, avec le nombre de non-lus. */
function HeaderBell({ href, unread }: { href: string; unread: number }) {
  const tNotif = useTranslations("notifications");
  const gesture = useRef<AnimatedIconHandle>(null);
  const label =
    unread > 0
      ? `${tNotif("menu")} · ${tNotif("unreadBadge", { count: unread })}`
      : tNotif("menu");
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      onPointerEnter={() => gesture.current?.start()}
      onPointerLeave={() => gesture.current?.stop()}
      onFocus={() => gesture.current?.start()}
      onBlur={() => gesture.current?.stop()}
      className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <BellIcon ref={gesture} size={18} />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 font-mono text-[10px] font-semibold text-ink-on-brand tabular-nums ring-2 ring-background"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

/**
 * Coquille commune aux espaces, dans l'esprit du site public : menu latéral
 * (repliable, tiroir sur mobile) avec pastilles lumineuses et fond actif qui
 * glisse, changement d'espace, fil d'Ariane, cloche, compte et thème.
 * `mobileTabs` : adresses des entrées reprises dans la barre d'onglets du
 * téléphone (cinq au plus).
 */
export function AppShell({
  space,
  spaces,
  nav,
  userName,
  mobileTabs,
  children,
}: {
  space: string;
  spaces: ShellSpace[];
  nav: ShellNavItem[];
  userName: string;
  mobileTabs?: string[];
  children: ReactNode;
}) {
  const t = useTranslations("shell");
  const tApp = useTranslations("app");
  const tNotif = useTranslations("notifications");
  const pathname = usePathname();
  const { count: unread, stop: stopUnread } = useUnreadMessages(pathname);
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
  const activeItem = nav.find((item) => item.href === active);
  const currentSpace = spaces.find((s) => s.key === space);
  const spaceLabel = currentSpace?.label ?? "";
  const messagesHref =
    nav.find((item) => item.icon === "messages")?.href ??
    "/compte/notifications";

  // Trois groupes (le travail, les échanges, le compte), dans l'ordre du menu.
  const groups = [0, 1, 2]
    .map((g) => nav.filter((item) => NAV_GROUP[item.icon] === g))
    .filter((items) => items.length > 0);

  const tabs = (mobileTabs ?? [])
    .map((href) => nav.find((item) => item.href === href))
    .filter((item): item is ShellNavItem => item !== undefined)
    .slice(0, 5);

  async function logout() {
    stopUnread();
    await mutate("POST", "/auth/logout");
    router.push("/connexion");
    router.refresh();
  }

  const tNav = useTranslations("nav");
  const countBadge = (count: number | undefined) =>
    count && count > 0 ? (
      <SidebarMenuBadge
        aria-label={tNav("countBadge", { count })}
        className="top-2! rounded-full bg-brand px-1.5 font-mono text-[11px] font-semibold text-ink-on-brand peer-hover/menu-button:text-ink-on-brand peer-data-[active=true]/menu-button:text-ink-on-brand"
      >
        {count > 99 ? "99+" : count}
      </SidebarMenuBadge>
    ) : null;

  const unreadBadge =
    unread > 0 ? (
      <SidebarMenuBadge
        aria-label={tNotif("unreadBadge", { count: unread })}
        className="top-2! rounded-full bg-brand px-1.5 font-mono text-[11px] font-semibold text-ink-on-brand peer-hover/menu-button:text-ink-on-brand peer-data-[active=true]/menu-button:text-ink-on-brand"
      >
        {unread > 99 ? "99+" : unread}
      </SidebarMenuBadge>
    ) : null;

  return (
    <ShellContext value={{ spaceLabel }}>
      <SidebarProvider>
        <CloseDrawerOnNavigate pathname={pathname} />
        <Sidebar variant="inset" collapsible="icon">
          <SidebarHeader className="pb-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  aria-label={t("switchSpace")}
                  className="gap-2.5 data-[state=open]:bg-sidebar-accent"
                >
                  <WemaMark />
                  <span className="grid flex-1 text-left leading-tight">
                    <span className="text-[15px] font-semibold tracking-tight text-foreground">
                      {tApp("name")}
                    </span>
                    <span className="truncate font-mono text-[11px] tracking-wide text-muted-foreground">
                      {spaceLabel}
                    </span>
                  </span>
                  {spaces.length > 1 && (
                    <CaretUpDown className="ml-auto text-muted-foreground" />
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              {spaces.length > 1 && (
                <DropdownMenuContent align="start" className="min-w-60">
                  <DropdownMenuLabel className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground">
                    {t("switchSpace")}
                  </DropdownMenuLabel>
                  {spaces.map((s) => (
                    <SpaceRow key={s.key} space={s} current={s.key === space} />
                  ))}
                </DropdownMenuContent>
              )}
            </DropdownMenu>
          </SidebarHeader>
          <SidebarContent className="gap-0">
            <ActiveMarkerGroup id="shell-nav">
              {groups.map((items, index) => (
                <SidebarGroup key={items[0]?.href ?? index} className="py-1.5">
                  {index > 0 && <SidebarSeparator className="mx-1.5 mb-2.5" />}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {items.map((item) => (
                        <NavEntry
                          key={item.href}
                          item={item}
                          active={item.href === active}
                          page={item.href === pathname}
                          badge={
                            item.count !== undefined
                              ? countBadge(item.count)
                              : item.icon === "messages"
                                ? unreadBadge
                                : undefined
                          }
                        />
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </ActiveMarkerGroup>
          </SidebarContent>
          <SidebarFooter>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  aria-label={t("account")}
                  className="gap-2.5 data-[state=open]:bg-sidebar-accent"
                >
                  <Avatar className="size-8 rounded-full">
                    <AvatarFallback className="rounded-full bg-surface text-xs font-semibold text-foreground ring-1 ring-sidebar-border">
                      {initials(userName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium text-foreground">
                      {userName}
                    </span>
                    <span className="truncate font-mono text-[11px] tracking-wide text-muted-foreground">
                      {spaceLabel}
                    </span>
                  </span>
                  <CaretUpDown className="ml-auto text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="min-w-60"
              >
                <DropdownMenuLabel className="flex items-center gap-2.5">
                  <Avatar className="size-8 rounded-full">
                    <AvatarFallback className="rounded-full bg-surface-subtle text-xs font-semibold">
                      {initials(userName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid min-w-0 leading-tight">
                    <span className="truncate font-sans text-sm font-medium tracking-normal">
                      {userName}
                    </span>
                    <span className="truncate font-mono text-[11px] font-normal tracking-wide text-muted-foreground">
                      {spaceLabel}
                    </span>
                  </span>
                </DropdownMenuLabel>
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
                  {resolvedTheme === "dark"
                    ? t("theme.light")
                    : t("theme.dark")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={logout}>
                  <SignOut />
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-transparent bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:rounded-t-xl md:px-6">
            <SidebarTrigger
              className="-ml-1 size-9 text-muted-foreground hover:text-foreground"
              aria-label={t("toggleSidebar")}
            />
            <Separator
              orientation="vertical"
              className="mr-1 data-[orientation=vertical]:h-4"
            />
            <span className="flex items-center gap-2 md:hidden">
              <WemaMark className="size-7 text-sm" />
              <span className="text-[15px] font-semibold tracking-tight">
                {tApp("name")}
              </span>
            </span>
            <Breadcrumb
              aria-label="Fil d'Ariane"
              className="hidden min-w-0 md:block"
            >
              <BreadcrumbList className="flex-nowrap font-mono text-xs tracking-wide sm:gap-2">
                {currentSpace && (
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      asChild
                      className="border-border bg-card py-0.5 pl-0.5 shadow-xs"
                    >
                      <Link href={currentSpace.href}>
                        <CrumbSpaceIcon spaceKey={currentSpace.key} />
                        {spaceLabel}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                )}
                {activeItem && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem className="min-w-0">
                      {activeItem.href === pathname ? (
                        <BreadcrumbPage className="truncate">
                          {activeItem.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild className="truncate">
                          <Link href={activeItem.href}>{activeItem.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1">
              <HeaderBell href={messagesHref} unread={unread} />
            </div>
          </header>
          <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 pt-4 pb-10 md:px-8 md:pt-6">
            {children}
          </div>
          {/* Avec la barre d'onglets du téléphone, le pied de page reste lisible au-dessus. */}
          <footer
            className={cn(
              "px-4 pb-6 md:px-8",
              tabs.length > 0 && "pb-24 md:pb-6",
            )}
          >
            <LegalLinks />
          </footer>
        </SidebarInset>
        {tabs.length > 0 && (
          <MobileTabBar
            items={tabs}
            activeHref={active}
            label={tApp("name")}
            unread={{ [messagesHref]: unread }}
          />
        )}
      </SidebarProvider>
    </ShellContext>
  );
}
