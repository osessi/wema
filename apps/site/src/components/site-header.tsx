"use client";

import { List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { appLinks, pages } from "../lib/site";
import { cx } from "./kit";
import { Logo } from "./logo";

/**
 * Barre flottante, centrée : le menu à gauche, le logo au centre, l'essai à
 * droite. Le menu s'ouvre sous la barre (pages du site et connexion).
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Node && !panel.current?.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-3 z-50 px-3">
      <div
        ref={panel}
        className="pointer-events-auto relative mx-auto max-w-[560px]"
      >
        <nav
          aria-label="Navigation principale"
          className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 border border-line bg-paper/85 px-2.5 shadow-[0_10px_30px_-18px_rgb(22_21_18/0.35)] backdrop-blur-md"
        >
          <button
            type="button"
            aria-expanded={open}
            aria-controls="menu-site"
            onClick={() => setOpen((v) => !v)}
            className="flex w-fit items-center gap-2 px-2 py-2 font-mono text-[12px] uppercase"
          >
            {open ? (
              <X size={16} aria-hidden="true" />
            ) : (
              <List size={16} aria-hidden="true" />
            )}
            Menu
          </button>
          <Logo />
          <a
            href={appLinks.signup}
            className="notch-btn justify-self-end max-sm:px-2.5 max-sm:text-[11px]"
          >
            <span className="max-sm:hidden">Essai gratuit</span>
            <span className="sm:hidden">Essayer</span>
            <svg
              viewBox="0 0 10 10"
              aria-hidden="true"
              className="size-2.5 fill-current"
            >
              <path d="M1 1v5h6.3L5.4 4.1l.8-.8L9.4 6.5 6.2 9.7l-.8-.8L7.3 7H0V1Z" />
            </svg>
          </a>
        </nav>

        <div
          id="menu-site"
          hidden={!open}
          className="mt-2 border border-line bg-paper p-2 shadow-[0_24px_50px_-24px_rgb(22_21_18/0.4)]"
        >
          <ul className="grid gap-px sm:grid-cols-2">
            {[{ href: "/", label: "Accueil" }, ...pages].map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-3 text-[15px] hover:bg-surface"
                >
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-line px-3 pt-3 pb-1">
            <span className="text-sm text-ink-muted">Déjà inscrit ?</span>
            <a
              href={appLinks.login}
              className={cx(
                "font-mono text-[12px] uppercase underline decoration-line-strong underline-offset-4 hover:decoration-ink",
              )}
            >
              Se connecter
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
