"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { mutate } from "../lib/mutate";

export interface NavItem {
  href: string;
  label: string;
}

export function Sidebar({
  items,
  userName,
}: {
  items: NavItem[];
  userName: string;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const current = (href: string) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href);

  async function logout() {
    await mutate("POST", "/auth/logout");
    router.push("/connexion");
    router.refresh();
  }

  return (
    <nav className="w-sidebar" aria-label={t("app.tagline")}>
      <div className="w-sidebar__brand">{t("app.name")}</div>
      <div className="w-sidebar__tagline">{t("app.tagline")}</div>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="w-sidebar__link"
          aria-current={current(item.href) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
      <div className="w-sidebar__footer">
        <div>{userName}</div>
        <button
          type="button"
          className="w-btn w-btn--ghost w-btn--sm"
          style={{ padding: 0, color: "#9db7d8" }}
          onClick={logout}
        >
          {t("auth.logout")}
        </button>
      </div>
    </nav>
  );
}
