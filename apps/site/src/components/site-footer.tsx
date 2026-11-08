import Link from "next/link";
import { appLinks, pages } from "../lib/site";
import { Mono } from "./kit";
import { Logo } from "./logo";

const legal = [
  { href: appLinks.legalNotice, label: "Mentions légales" },
  { href: appLinks.privacy, label: "Confidentialité" },
  { href: appLinks.terms, label: "Conditions d'utilisation" },
  { href: appLinks.cookies, label: "Cookies" },
];

export function SiteFooter() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-20 pb-10 sm:px-6">
      <div className="grid gap-10 border-t border-line-strong pt-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[14.5px] leading-relaxed text-ink-muted">
            Un prof particulier IA par matière, qui fait trouver au lieu de
            donner la réponse.
          </p>
        </div>
        <div>
          <Mono className="text-ink-muted uppercase">Le site</Mono>
          <ul className="mt-4 space-y-2.5 text-[14.5px]">
            {pages.map((page) => (
              <li key={page.href}>
                <Link href={page.href} className="hover:text-brand-ink">
                  {page.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={appLinks.login} className="hover:text-brand-ink">
                Se connecter
              </a>
            </li>
          </ul>
        </div>
        <div>
          <Mono className="text-ink-muted uppercase">Informations légales</Mono>
          <ul className="mt-4 space-y-2.5 text-[14.5px]">
            {legal.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="hover:text-brand-ink">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p
        aria-hidden="true"
        className="mt-16 font-display text-[clamp(5rem,22vw,17rem)] leading-[0.8] font-light tracking-[-0.06em] text-line-strong select-none"
      >
        wěmà
      </p>
      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <Mono className="text-ink-muted">
          © {new Date().getFullYear()} Wema
        </Mono>
        <Mono className="text-ink-muted">
          Wěmà, en fon : le livre, la lettre.
        </Mono>
      </div>
    </footer>
  );
}
