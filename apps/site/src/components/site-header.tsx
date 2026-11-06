import { List } from "@phosphor-icons/react/ssr";
import { appLinks } from "../lib/site";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ground/95 backdrop-blur">
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6"
      >
        <Logo />
        <NavLinks className="hidden flex-1 items-center gap-1 md:flex" />
        <a
          href={appLinks.login}
          className="ml-auto hidden rounded-lg border border-line-strong px-4 py-2 text-[15px] font-medium transition-colors hover:border-ink md:ml-0 md:inline-block"
        >
          Se connecter
        </a>

        {/* Mobile : menu sans JavaScript. */}
        <details className="group relative ml-auto md:hidden">
          <summary
            className="grid size-11 cursor-pointer place-items-center rounded-lg border border-line-strong"
            aria-label="Ouvrir le menu"
          >
            <List size={22} aria-hidden="true" />
          </summary>
          <div className="absolute right-0 top-14 w-64 rounded-xl border border-line bg-surface p-2 shadow-lg">
            <NavLinks className="flex flex-col" />
            <div className="mt-2 border-t border-line pt-2">
              <a
                href={appLinks.login}
                className="block rounded-md px-3 py-2 text-[15px] font-medium"
              >
                Se connecter
              </a>
              <a
                href={appLinks.signup}
                className="block rounded-md px-3 py-2 text-[15px] font-medium"
              >
                Commencer l'essai gratuit
              </a>
            </div>
          </div>
        </details>
      </nav>
    </header>
  );
}
