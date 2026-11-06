"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pages } from "../lib/site";

export function NavLinks({ className }: { className: string }) {
  const pathname = usePathname();
  return (
    <ul className={className}>
      {pages.map((page) => {
        const current = pathname === page.href;
        return (
          <li key={page.href}>
            <Link
              href={page.href}
              aria-current={current ? "page" : undefined}
              className={`block rounded-md px-3 py-2 text-[15px] transition-colors hover:text-ink ${
                current ? "font-medium text-ink" : "text-muted-foreground"
              }`}
            >
              {page.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
